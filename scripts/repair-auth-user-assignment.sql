-- Repair: profile var ama branch assignment yok (SQL sonrası kopmuş olabilir)
-- Supabase SQL Editor — email'i değiştir, Run

do $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_owner_role_id uuid;
  v_email text := 'BURAYA_EMAIL@example.com';
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then
    raise exception 'Auth user not found for %', v_email;
  end if;

  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then
    raise notice 'No profile row — app''te /onboarding ile bootstrap_clinic çalıştırın (login sonrası).';
    return;
  end if;

  select id into v_branch_id
  from public.branches
  where organization_id = v_org_id and coalesce(is_active, true)
  order by created_at nulls last
  limit 1;

  if v_branch_id is null then
    insert into public.branches (organization_id, name)
    values (v_org_id, 'Main Clinic')
    returning id into v_branch_id;
  end if;

  select id into v_owner_role_id from public.roles where name = 'owner' limit 1;
  if v_owner_role_id is null then
    raise exception 'owner role missing — roles seed uygulanmamış olabilir';
  end if;

  insert into public.staff_profiles (profile_id, is_active)
  values (v_user_id, true)
  on conflict (profile_id) do update set is_active = true;

  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
  values (v_user_id, v_branch_id, v_owner_role_id)
  on conflict (profile_id, branch_id) do update set role_id = excluded.role_id;

  raise notice 'Fixed assignments for % → branch %', v_email, v_branch_id;
end $$;
