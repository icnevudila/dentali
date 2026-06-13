-- Branch settings key-value + get_branch_context polish

alter table public.branch_settings drop constraint if exists branch_settings_pkey;
alter table public.branch_settings add constraint branch_settings_pkey primary key (branch_id, key);

create or replace function public.set_branch_setting(
  p_branch_id uuid,
  p_key text,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key not in ('timezone', 'currency_code', 'display_name') then
    raise exception 'Unsupported branch setting key';
  end if;

  if not public.has_permission('settings.manage', p_branch_id) then
    raise exception 'Permission denied';
  end if;

  insert into public.branch_settings (branch_id, key, value, updated_at)
  values (p_branch_id, p_key, p_value, now())
  on conflict (branch_id, key) do update
    set value = excluded.value, updated_at = now();
end;
$$;

grant execute on function public.set_branch_setting(uuid, text, text) to authenticated;

create or replace function public.get_branch_context(p_branch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'branch_id', b.id,
    'branch_name', b.name,
    'organization_id', b.organization_id,
    'is_active', b.is_active,
    'timezone', coalesce(bs_tz.value, os.default_timezone, o.timezone, 'Asia/Manila'),
    'currency_code', coalesce(bs_cur.value, os.currency_code, 'PHP'),
    'branch_overrides', coalesce((
      select jsonb_object_agg(bs.key, bs.value)
      from public.branch_settings bs
      where bs.branch_id = b.id
    ), '{}'::jsonb)
  )
  from public.branches b
  join public.organizations o on o.id = b.organization_id
  left join public.organization_settings os on os.organization_id = b.organization_id
  left join public.branch_settings bs_tz on bs_tz.branch_id = b.id and bs_tz.key = 'timezone'
  left join public.branch_settings bs_cur on bs_cur.branch_id = b.id and bs_cur.key = 'currency_code'
  where b.id = p_branch_id
    and b.organization_id = public.current_user_org_id()
    and (
      public.user_is_org_admin()
      or public.user_has_branch_access(p_branch_id)
    );
$$;

grant execute on function public.get_branch_context(uuid) to authenticated;
