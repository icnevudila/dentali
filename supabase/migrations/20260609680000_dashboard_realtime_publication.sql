-- Dashboard KPI: enable Realtime on tables that drive get_dashboard_stats

do $$
declare
  t text;
begin
  foreach t in array array[
    'appointments',
    'patient_consents',
    'invoices',
    'invoice_payments',
    'patients',
    'queue_entries'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
