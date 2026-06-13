-- Module 05: Duplicate patient detection stub

create or replace function public.detect_duplicate_patient(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date default null,
  p_phone text default null
)
returns table (
  patient_id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  match_reason text,
  score int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_phone_norm text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.date_of_birth,
    p.phone,
    case
      when v_phone_norm is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = v_phone_norm
        then 'phone'
      when p_date_of_birth is not null
        and p.date_of_birth = p_date_of_birth
        and lower(p.first_name) = lower(trim(p_first_name))
        and lower(p.last_name) = lower(trim(p_last_name))
        then 'name_dob'
      else 'name'
    end as match_reason,
    case
      when v_phone_norm is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = v_phone_norm then 100
      when p_date_of_birth is not null
        and p.date_of_birth = p_date_of_birth
        and lower(p.first_name) = lower(trim(p_first_name))
        and lower(p.last_name) = lower(trim(p_last_name)) then 90
      else 60
    end as score
  from public.patients p
  where p.organization_id = v_org
    and p.status = 'active'
    and (
      (v_phone_norm is not null and regexp_replace(coalesce(p.phone, ''), '[^0-9+]', '', 'g') = v_phone_norm)
      or (
        lower(p.first_name) = lower(trim(p_first_name))
        and lower(p.last_name) = lower(trim(p_last_name))
        and (p_date_of_birth is null or p.date_of_birth = p_date_of_birth)
      )
    )
  order by score desc
  limit 10;
end;
$$;

grant execute on function public.detect_duplicate_patient(text, text, date, text) to authenticated;
