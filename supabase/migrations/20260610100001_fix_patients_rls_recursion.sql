-- Break infinite RLS recursion: patients_select → patient_branch_links → patients

create or replace function public.patient_org_id(p_patient_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select organization_id from public.patients where id = p_patient_id;
$$;

grant execute on function public.patient_org_id(uuid) to authenticated;

drop policy if exists patient_branch_links_all on public.patient_branch_links;

create policy patient_branch_links_all on public.patient_branch_links
  for all to authenticated
  using (
    exists (
      select 1
      from public.branches b
      where b.id = patient_branch_links.branch_id
        and b.organization_id = public.current_user_org_id()
    )
    and public.patient_org_id(patient_id) = public.current_user_org_id()
  )
  with check (
    exists (
      select 1
      from public.branches b
      where b.id = patient_branch_links.branch_id
        and b.organization_id = public.current_user_org_id()
    )
    and public.patient_org_id(patient_id) = public.current_user_org_id()
  );

drop policy if exists patient_contacts_all on public.patient_contacts;

create policy patient_contacts_all on public.patient_contacts
  for all to authenticated
  using (
    public.patient_org_id(patient_id) = public.current_user_org_id()
  )
  with check (
    public.patient_org_id(patient_id) = public.current_user_org_id()
  );
