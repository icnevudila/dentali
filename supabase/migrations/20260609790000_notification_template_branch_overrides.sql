-- Module 18: Branch-specific notification template overrides

create or replace function public.get_notification_template_for_branch(
  p_branch_id uuid,
  p_template_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_branch_tpl public.notification_templates%rowtype;
  v_org_tpl public.notification_templates%rowtype;
begin
  select b.organization_id into v_org
  from public.branches b
  where b.id = p_branch_id;

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  select * into v_branch_tpl
  from public.notification_templates nt
  where nt.organization_id = v_org
    and nt.branch_id = p_branch_id
    and nt.template_key = p_template_key
    and nt.is_active = true
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_branch_tpl.id,
      'template_key', v_branch_tpl.template_key,
      'name', v_branch_tpl.name,
      'body', v_branch_tpl.body,
      'is_branch_override', true
    );
  end if;

  select * into v_org_tpl
  from public.notification_templates nt
  where nt.organization_id = v_org
    and nt.branch_id is null
    and nt.template_key = p_template_key
    and nt.is_active = true
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_org_tpl.id,
    'template_key', v_org_tpl.template_key,
    'name', v_org_tpl.name,
    'body', v_org_tpl.body,
    'is_branch_override', false
  );
end;
$$;

create or replace function public.get_effective_notification_templates(p_branch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_rows jsonb;
begin
  if not public.has_permission('notifications.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select b.organization_id into v_org
  from public.branches b
  where b.id = p_branch_id;

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'template_key', org_tpl.template_key,
      'name', org_tpl.name,
      'channel', org_tpl.channel,
      'org_template_id', org_tpl.id,
      'org_default_body', org_tpl.body,
      'branch_template_id', br_tpl.id,
      'effective_id', coalesce(br_tpl.id, org_tpl.id),
      'effective_body', coalesce(br_tpl.body, org_tpl.body),
      'is_branch_override', br_tpl.id is not null,
      'is_active', coalesce(br_tpl.is_active, org_tpl.is_active)
    )
    order by org_tpl.name
  ), '[]'::jsonb)
  into v_rows
  from public.notification_templates org_tpl
  left join public.notification_templates br_tpl
    on br_tpl.organization_id = org_tpl.organization_id
    and br_tpl.branch_id = p_branch_id
    and br_tpl.template_key = org_tpl.template_key
  where org_tpl.organization_id = v_org
    and org_tpl.branch_id is null;

  return v_rows;
end;
$$;

create or replace function public.upsert_branch_notification_template(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := (p_payload->>'branch_id')::uuid;
  v_template_key text := nullif(trim(p_payload->>'template_key'), '');
  v_body text := nullif(trim(p_payload->>'body'), '');
  v_org uuid;
  v_org_tpl public.notification_templates%rowtype;
  v_id uuid;
begin
  if v_branch_id is null or v_template_key is null or v_body is null then
    raise exception 'branch_id, template_key, and body are required';
  end if;

  if not public.has_permission('notifications.write', v_branch_id) then
    raise exception 'Permission denied';
  end if;

  select b.organization_id into v_org
  from public.branches b
  where b.id = v_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  select * into v_org_tpl
  from public.notification_templates nt
  where nt.organization_id = v_org
    and nt.branch_id is null
    and nt.template_key = v_template_key;

  if not found then
    raise exception 'Org template not found for key %', v_template_key;
  end if;

  select nt.id into v_id
  from public.notification_templates nt
  where nt.organization_id = v_org
    and nt.branch_id = v_branch_id
    and nt.template_key = v_template_key;

  if found then
    update public.notification_templates
    set body = v_body,
        is_active = true,
        updated_by = auth.uid(),
        updated_at = now()
    where id = v_id;
  else
    insert into public.notification_templates (
      organization_id, branch_id, template_key, name, channel, body, is_active, created_by, updated_by
    ) values (
      v_org, v_branch_id, v_template_key, v_org_tpl.name, v_org_tpl.channel, v_body, true, auth.uid(), auth.uid()
    )
    returning id into v_id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org, v_branch_id, auth.uid(), 'notification_template.branch_override',
    'notification_template', v_id::text,
    jsonb_build_object('template_key', v_template_key)
  );

  return jsonb_build_object('id', v_id, 'template_key', v_template_key, 'is_branch_override', true);
end;
$$;

create or replace function public.delete_branch_notification_override(
  p_branch_id uuid,
  p_template_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if not public.has_permission('notifications.write', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  select b.organization_id into v_org
  from public.branches b
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id();

  if v_org is null then
    raise exception 'Branch not found';
  end if;

  delete from public.notification_templates
  where organization_id = v_org
    and branch_id = p_branch_id
    and template_key = p_template_key;

  insert into public.organization_audit_logs (
    organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata
  ) values (
    v_org, p_branch_id, auth.uid(), 'notification_template.branch_override_removed',
    'notification_template', p_template_key,
    jsonb_build_object('template_key', p_template_key)
  );
end;
$$;

grant execute on function public.get_notification_template_for_branch(uuid, text) to authenticated;
grant execute on function public.get_notification_template_for_branch(uuid, text) to service_role;
grant execute on function public.get_effective_notification_templates(uuid) to authenticated;
grant execute on function public.upsert_branch_notification_template(jsonb) to authenticated;
grant execute on function public.delete_branch_notification_override(uuid, text) to authenticated;
