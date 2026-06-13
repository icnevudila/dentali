-- Staff email invitations (accepted on first login via accept_staff_invitation)

create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create unique index if not exists idx_staff_invitations_pending_email
  on public.staff_invitations (organization_id, lower(email))
  where status = 'pending';

alter table public.staff_invitations enable row level security;

create policy staff_invitations_select on public.staff_invitations for select using (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

create policy staff_invitations_insert on public.staff_invitations for insert with check (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

create policy staff_invitations_update on public.staff_invitations for update using (
  organization_id = public.current_user_org_id()
  and public.user_is_org_admin()
);

-- Accept pending invite for the authenticated user (called after magic link / invite login)
create or replace function public.accept_staff_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_inv public.staff_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  select * into v_inv
  from public.staff_invitations
  where lower(email) = lower(v_email)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('status', 'no_invitation');
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles (id, organization_id, email, full_name)
    values (
      v_user_id,
      v_inv.organization_id,
      v_email,
      coalesce(v_inv.full_name, split_part(v_email, '@', 1))
    );
    insert into public.staff_profiles (profile_id, is_active)
    values (v_user_id, true);
  else
    update public.profiles
    set organization_id = v_inv.organization_id,
        full_name = coalesce(full_name, v_inv.full_name)
    where id = v_user_id;
  end if;

  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
  values (v_user_id, v_inv.branch_id, v_inv.role_id)
  on conflict (profile_id, branch_id) do update set role_id = excluded.role_id;

  update public.staff_invitations
  set status = 'accepted'
  where id = v_inv.id;

  return jsonb_build_object(
    'status', 'accepted',
    'organization_id', v_inv.organization_id,
    'branch_id', v_inv.branch_id
  );
end;
$$;
