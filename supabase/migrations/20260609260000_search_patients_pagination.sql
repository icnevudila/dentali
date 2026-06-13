-- Pagination + total count for patient search
create or replace function public.search_patients(
  p_query text,
  p_branch_id uuid default null,
  p_limit int default 20,
  p_offset int default 0
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
  total_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.phone,
    p.email,
    p.status,
    pbl.last_visit_at,
    count(*) over() as total_count
  from public.patients p
  left join public.patient_branch_links pbl
    on pbl.patient_id = p.id and pbl.branch_id = p_branch_id
  where p.organization_id = public.current_user_org_id()
    and p.status = 'active'
    and (
      p_query is null or p_query = ''
      or p.first_name ilike '%' || p_query || '%'
      or p.last_name ilike '%' || p_query || '%'
      or p.phone ilike '%' || p_query || '%'
    )
  order by p.last_name, p.first_name
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;
