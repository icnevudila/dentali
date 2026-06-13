-- Public marketing lead capture (quote / contact forms on landing pages)

create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null default 'quote' check (lead_type in ('quote', 'contact')),
  full_name text not null,
  email text not null,
  phone text,
  clinic_name text,
  branch_count integer,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketing_leads_created_at_idx on public.marketing_leads (created_at desc);
create index if not exists marketing_leads_email_idx on public.marketing_leads (email);

alter table public.marketing_leads enable row level security;

create policy marketing_leads_service_read on public.marketing_leads
  for select
  to service_role
  using (true);

create or replace function public.submit_marketing_lead(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_email text;
begin
  v_name := nullif(trim(p_payload->>'full_name'), '');
  v_email := nullif(lower(trim(p_payload->>'email')), '');

  if v_name is null then
    raise exception 'full_name is required';
  end if;
  if v_email is null then
    raise exception 'email is required';
  end if;

  insert into public.marketing_leads (
    lead_type,
    full_name,
    email,
    phone,
    clinic_name,
    branch_count,
    message,
    metadata
  )
  values (
    coalesce(nullif(trim(p_payload->>'lead_type'), ''), 'quote'),
    v_name,
    v_email,
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'clinic_name'), ''),
    nullif(trim(p_payload->>'branch_count'), '')::integer,
    nullif(trim(p_payload->>'message'), ''),
    coalesce(p_payload->'metadata', '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_marketing_lead(jsonb) from public;
grant execute on function public.submit_marketing_lead(jsonb) to anon, authenticated, service_role;
