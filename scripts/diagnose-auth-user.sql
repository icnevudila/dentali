-- Auth / profile diagnostic — Supabase SQL Editor
-- 1) Replace the email in the WHERE clause below
-- 2) Run all queries

-- Auth user
select id, email, email_confirmed_at, last_sign_in_at, created_at
from auth.users
where lower(email) = lower('BURAYA_EMAIL@example.com');

-- Profile + org + staff
select
  u.id as user_id,
  u.email,
  p.organization_id,
  o.name as org_name,
  p.full_name,
  sp.is_active as staff_active
from auth.users u
left join public.profiles p on p.id = u.id
left join public.organizations o on o.id = p.organization_id
left join public.staff_profiles sp on sp.profile_id = u.id
where lower(u.email) = lower('BURAYA_EMAIL@example.com');

-- Branch assignments (dashboard için en az 1 satır gerekir)
select b.name as branch, r.name as role, b.is_active as branch_active
from auth.users u
left join public.staff_branch_assignments sba on sba.profile_id = u.id
left join public.branches b on b.id = sba.branch_id
left join public.roles r on r.id = sba.role_id
where lower(u.email) = lower('BURAYA_EMAIL@example.com');

-- get_my_branches simülasyonu (profile varsa org_id döner)
select public.current_user_org_id() as org_from_profile;
-- Not: current_user_org_id() SQL Editor'da auth.uid() null olur — sadece app oturumunda anlamlı
