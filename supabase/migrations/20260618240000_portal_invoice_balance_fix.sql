-- Portal invoice balance: use total_amount - paid_amount (balance_due column does not exist).

create or replace function public.get_patient_portal_snapshot(
  p_session_id uuid,
  p_phone text,
  p_last_name text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_session public.kiosk_sessions%rowtype;
  v_patient_id uuid;
  v_patient record;
  v_queue record;
  v_ahead int := 0;
  v_balance numeric := 0;
  v_pending int;
  v_consents jsonb := '[]'::jsonb;
  v_slug text;
  v_consent record;
begin
  select * into v_session from public.kiosk_sessions where id = p_session_id;
  if not found or v_session.expires_at < now() then
    raise exception 'Session expired. Please refresh the page.';
  end if;

  v_patient_id := public._portal_resolve_patient(p_session_id, p_phone, p_last_name);
  perform public._portal_ensure_branch_link(v_patient_id, v_session.branch_id);
  perform public._ensure_intake_consents_for_patient(
    v_patient_id,
    v_session.organization_id,
    v_session.branch_id,
    'portal'
  );

  select p.id, p.first_name, p.last_name
  into v_patient
  from public.patients p
  where p.id = v_patient_id;

  select qe.id, qe.display_code, qe.status, qe.checked_in_at
  into v_queue
  from public.queue_entries qe
  where qe.patient_id = v_patient_id
    and qe.branch_id = v_session.branch_id
    and qe.status in ('waiting', 'ready', 'now_serving', 'in_chair')
    and qe.checked_in_at::date = (timezone('Asia/Manila', now()))::date
  order by qe.checked_in_at desc
  limit 1;

  if v_queue.id is not null and v_queue.status in ('waiting', 'ready') then
    select count(*)::int into v_ahead
    from public.queue_entries qe
    where qe.branch_id = v_session.branch_id
      and qe.status in ('waiting', 'ready')
      and qe.checked_in_at::date = (timezone('Asia/Manila', now()))::date
      and qe.checked_in_at < v_queue.checked_in_at;
  end if;

  select coalesce(sum(greatest(i.total_amount - i.paid_amount, 0)), 0) into v_balance
  from public.invoices i
  where i.patient_id = v_patient_id
    and i.organization_id = v_session.organization_id
    and i.status not in ('void', 'paid')
    and greatest(i.total_amount - i.paid_amount, 0) > 0;

  v_pending := public._pending_intake_consent_count(v_patient_id, v_session.organization_id);

  foreach v_slug in array array['general-treatment', 'dpa-consent']
  loop
    select pc.id, pc.template_slug, pc.template_name, pc.status
    into v_consent
    from public.patient_consents pc
    where pc.patient_id = v_patient_id
      and pc.organization_id = v_session.organization_id
      and pc.template_slug = v_slug
      and pc.status <> 'voided'
    order by pc.created_at desc
    limit 1;

    v_consents := v_consents || jsonb_build_array(
      jsonb_build_object(
        'slug', v_slug,
        'name', coalesce(v_consent.template_name, v_slug),
        'status', coalesce(v_consent.status, 'not_started'),
        'consent_id', v_consent.id
      )
    );
  end loop;

  return jsonb_build_object(
    'patient_id', v_patient_id,
    'patient_name', trim(coalesce(v_patient.first_name, '') || ' ' || coalesce(v_patient.last_name, '')),
    'branch_id', v_session.branch_id,
    'queue', case
      when v_queue.id is null then null
      else jsonb_build_object(
        'entry_id', v_queue.id,
        'display_code', v_queue.display_code,
        'status', v_queue.status,
        'ahead_count', v_ahead
      )
    end,
    'balance', jsonb_build_object(
      'open_balance', v_balance,
      'has_balance', v_balance > 0
    ),
    'consents', v_consents,
    'pending_intake_consents', v_pending,
    'ready_for_checkin', v_pending = 0
  );
end;
$$;
