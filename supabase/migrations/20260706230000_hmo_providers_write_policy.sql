-- RLS policy to allow organization admins to manage HMO providers
create policy hmo_providers_write on public.hmo_providers
  for all to authenticated using (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  )
  with check (
    organization_id = public.current_user_org_id()
    and public.user_is_org_admin()
  );
