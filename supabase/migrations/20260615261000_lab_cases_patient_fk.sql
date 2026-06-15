-- lab_cases was created without FK constraints; PostgREST needs them for patients(...) embeds.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_cases_patient_id_fkey'
      and conrelid = 'public.lab_cases'::regclass
  ) then
    alter table public.lab_cases
      add constraint lab_cases_patient_id_fkey
      foreign key (patient_id) references public.patients(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_cases_branch_id_fkey'
      and conrelid = 'public.lab_cases'::regclass
  ) then
    alter table public.lab_cases
      add constraint lab_cases_branch_id_fkey
      foreign key (branch_id) references public.branches(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lab_cases_organization_id_fkey'
      and conrelid = 'public.lab_cases'::regclass
  ) then
    alter table public.lab_cases
      add constraint lab_cases_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end $$;
