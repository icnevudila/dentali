-- Migration: Fix RLS Policies for Direct Staff/Provider Creation
-- Target: Resolve RLS inserts violations on public.profiles, public.staff_profiles, and public.staff_branch_assignments

-- ---------------------------------------------------------------------------
-- 1. Redefine public.profiles policies
-- ---------------------------------------------------------------------------
drop policy if exists profile_insert on public.profiles;
create policy profile_insert on public.profiles
  for insert with check (
    id = auth.uid()
    or (
      organization_id = public.current_user_org_id()
      and public.user_is_org_admin()
    )
  );

drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles
  for update using (
    id = auth.uid()
    or (
      organization_id = public.current_user_org_id()
      and public.user_is_org_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Redefine public.staff_profiles policies
-- ---------------------------------------------------------------------------
drop policy if exists sp_insert on public.staff_profiles;
create policy sp_insert on public.staff_profiles
  for insert with check (
    public.user_is_org_admin()
  );

drop policy if exists sp_update on public.staff_profiles;
create policy sp_update on public.staff_profiles
  for update using (
    profile_id = auth.uid()
    or public.user_is_org_admin()
  );

-- ---------------------------------------------------------------------------
-- 3. Redefine public.staff_branch_assignments policies
-- ---------------------------------------------------------------------------
drop policy if exists sba_insert on public.staff_branch_assignments;
create policy sba_insert on public.staff_branch_assignments
  for insert with check (
    public.user_is_org_admin()
  );

drop policy if exists sba_update on public.staff_branch_assignments;
create policy sba_update on public.staff_branch_assignments
  for update using (
    profile_id = auth.uid()
    or public.user_is_org_admin()
  );
