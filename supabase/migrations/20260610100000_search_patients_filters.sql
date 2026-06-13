-- Patient registry list: status, last-visit date, sort, intake score
create or replace function public.search_patients(
  p_query text,
  p_branch_id uuid default null,
  p_limit int default 20,
  p_offset int default 0,
  p_status text default 'active',
  p_last_visit_from timestamptz default null,
  p_last_visit_to timestamptz default null,
  p_never_visited boolean default false,
  p_sort text default 'name'
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  email text,
  status text,
  last_visit_at timestamptz,
  intake_pct int,
  total_count bigint
)
language sql stable security definer set search_path = public
as $$
  with base as (
    select
      p.id,
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.phone,
      p.email,
      p.status,
      pbl.last_visit_at,
      least(100, (
        (case when coalesce(p.phone, '') <> '' then 25 else 0 end)
        + (case when p.date_of_birth is not null then 25 else 0 end)
        + (case when exists (
            select 1 from public.patient_medical_histories pmh
            where pmh.patient_id = p.id
            limit 1
          ) then 25 else 0 end)
        + (case when exists (
            select 1 from public.patient_consents pc
            where pc.patient_id = p.id and pc.status = 'signed'
            limit 1
          ) then 25 else 0 end)
      ))::int as intake_pct
    from public.patients p
    left join public.patient_branch_links pbl
      on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
    where p.organization_id = public.current_user_org_id()
      and (
        p_status is null
        or p_status = 'all'
        or p.status = p_status
      )
      and (
        p_query is null
        or p_query = ''
        or p.first_name ilike '%' || p_query || '%'
        or p.last_name ilike '%' || p_query || '%'
        or p.phone ilike '%' || p_query || '%'
      )
      and (
        (not p_never_visited)
        or pbl.last_visit_at is null
      )
      and (
        p_never_visited
        or (
          (p_last_visit_from is null or pbl.last_visit_at >= p_last_visit_from)
          and (p_last_visit_to is null or pbl.last_visit_at <= p_last_visit_to)
        )
      )
  )
  select
    b.id,
    b.first_name,
    b.last_name,
    b.date_of_birth,
    b.phone,
    b.email,
    b.status,
    b.last_visit_at,
    b.intake_pct,
    count(*) over() as total_count
  from base b
  order by
    case when coalesce(p_sort, 'name') = 'last_visit_desc' then b.last_visit_at end desc nulls last,
    case when p_sort = 'last_visit_asc' then b.last_visit_at end asc nulls last,
    b.last_name asc,
    b.first_name asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;
