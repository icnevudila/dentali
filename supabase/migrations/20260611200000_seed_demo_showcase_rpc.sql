-- Demo showcase seed — idempotent RPC for landing page live previews
-- Run via SQL Editor: select public.seed_demo_showcase_data(null);

create or replace function public.seed_demo_showcase_data(p_branch_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid := p_branch_id;
  v_org_id uuid;
  v_manila_today date := (now() at time zone 'Asia/Manila')::date;
  v_hmo_provider uuid;
  v_proc_fill uuid;
  v_proc_exam uuid;
  v_proc_proph uuid;
  v_chart_id uuid := 'de0000b1-0000-4000-8000-000000000001'::uuid;
  v_patient1 uuid := 'de000001-0000-4000-8000-000000000001'::uuid;
begin
  if v_branch_id is null then
    select b.id, b.organization_id
    into v_branch_id, v_org_id
    from public.branches b
    order by b.created_at nulls last, b.id
    limit 1;
  else
    select b.organization_id into v_org_id
    from public.branches b
    where b.id = v_branch_id;
  end if;

  if v_branch_id is null or v_org_id is null then
    raise exception 'No branch found — bootstrap a clinic first';
  end if;

  perform public.seed_default_procedures(v_org_id);
  perform public.seed_hmo_providers(v_org_id);

  select id into v_hmo_provider
  from public.hmo_providers
  where organization_id = v_org_id
  order by name
  limit 1;

  select id into v_proc_exam
  from public.procedures
  where organization_id = v_org_id and code = 'EXAM'
  limit 1;

  select id into v_proc_proph
  from public.procedures
  where organization_id = v_org_id and code = 'PROPH'
  limit 1;

  select id into v_proc_fill
  from public.procedures
  where organization_id = v_org_id and code = 'FILL'
  limit 1;

  -- Patients (Filipino demo names)
  insert into public.patients (id, organization_id, first_name, last_name, date_of_birth, gender, phone, email, address, status)
  values
    (v_patient1, v_org_id, 'Maria', 'Santos', '1988-03-14', 'female', '+639171234001', 'maria.santos@example.ph', 'Quezon City, Metro Manila', 'active'),
    ('de000002-0000-4000-8000-000000000002'::uuid, v_org_id, 'Juan', 'Reyes', '1992-07-22', 'male', '+639171234002', 'juan.reyes@example.ph', 'Makati City, Metro Manila', 'active'),
    ('de000003-0000-4000-8000-000000000003'::uuid, v_org_id, 'Ana', 'Cruz', '1995-11-05', 'female', '+639171234003', 'ana.cruz@example.ph', 'Pasig City, Metro Manila', 'active'),
    ('de000004-0000-4000-8000-000000000004'::uuid, v_org_id, 'Jose', 'Garcia', '1980-01-18', 'male', '+639171234004', 'jose.garcia@example.ph', 'Taguig City, Metro Manila', 'active'),
    ('de000005-0000-4000-8000-000000000005'::uuid, v_org_id, 'Liza', 'Mendoza', '1998-09-30', 'female', '+639171234005', 'liza.mendoza@example.ph', 'Manila City', 'active'),
    ('de000006-0000-4000-8000-000000000006'::uuid, v_org_id, 'Carlo', 'Ramos', '1986-06-12', 'male', '+639171234006', 'carlo.ramos@example.ph', 'Mandaluyong City', 'active'),
    ('de000007-0000-4000-8000-000000000007'::uuid, v_org_id, 'Patricia', 'Villanueva', '1990-04-08', 'female', '+639171234007', 'patricia.v@example.ph', 'Paranaque City', 'active'),
    ('de000008-0000-4000-8000-000000000008'::uuid, v_org_id, 'Miguel', 'Torres', '1975-12-21', 'male', '+639171234008', 'miguel.torres@example.ph', 'Las Pinas City', 'active'),
    ('de000009-0000-4000-8000-000000000009'::uuid, v_org_id, 'Rosa', 'Aquino', '1993-02-27', 'female', '+639171234009', 'rosa.aquino@example.ph', 'Caloocan City', 'active'),
    ('de00000a-0000-4000-8000-00000000000a'::uuid, v_org_id, 'Diego', 'Fernandez', '1984-08-16', 'male', '+639171234010', 'diego.f@example.ph', 'San Juan City', 'active'),
    ('de00000b-0000-4000-8000-00000000000b'::uuid, v_org_id, 'Elena', 'Bautista', '1999-05-03', 'female', '+639171234011', 'elena.b@example.ph', 'Marikina City', 'active'),
    ('de00000c-0000-4000-8000-00000000000c'::uuid, v_org_id, 'Mark', 'Dela Cruz', '1991-10-11', 'male', '+639171234012', 'mark.delacruz@example.ph', 'Valenzuela City', 'active')
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    email = excluded.email,
    status = excluded.status,
    updated_at = now();

  insert into public.patient_branch_links (patient_id, branch_id, first_visit_at, last_visit_at)
  select p.id, v_branch_id, now() - interval '30 days', now() - interval '2 days'
  from public.patients p
  where p.id in (
    v_patient1,
    'de000002-0000-4000-8000-000000000002'::uuid,
    'de000003-0000-4000-8000-000000000003'::uuid,
    'de000004-0000-4000-8000-000000000004'::uuid,
    'de000005-0000-4000-8000-000000000005'::uuid,
    'de000006-0000-4000-8000-000000000006'::uuid,
    'de000007-0000-4000-8000-000000000007'::uuid,
    'de000008-0000-4000-8000-000000000008'::uuid,
    'de000009-0000-4000-8000-000000000009'::uuid,
    'de00000a-0000-4000-8000-00000000000a'::uuid,
    'de00000b-0000-4000-8000-00000000000b'::uuid,
    'de00000c-0000-4000-8000-00000000000c'::uuid
  )
  on conflict (patient_id, branch_id) do update set
    last_visit_at = excluded.last_visit_at;

  -- Today's appointments (Asia/Manila)
  insert into public.appointments (id, organization_id, branch_id, patient_id, scheduled_at, duration_minutes, purpose, status)
  values
    ('de000101-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1,
      (v_manila_today + time '09:00') at time zone 'Asia/Manila', 30, 'Check-up & cleaning', 'confirmed'),
    ('de000102-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid,
      (v_manila_today + time '09:30') at time zone 'Asia/Manila', 45, 'Composite filling #36', 'scheduled'),
    ('de000103-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid,
      (v_manila_today + time '10:00') at time zone 'Asia/Manila', 30, 'Follow-up', 'checked_in'),
    ('de000104-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid,
      (v_manila_today + time '08:00') at time zone 'Asia/Manila', 30, 'Oral exam', 'completed'),
    ('de000105-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid,
      (v_manila_today + time '08:30') at time zone 'Asia/Manila', 45, 'Root canal consult', 'completed'),
    ('de000106-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid,
      (v_manila_today + time '11:00') at time zone 'Asia/Manila', 30, 'Prophylaxis', 'scheduled'),
    ('de000107-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid,
      (v_manila_today + time '14:00') at time zone 'Asia/Manila', 30, 'Crown prep', 'confirmed')
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    purpose = excluded.purpose,
    updated_at = now();

  -- Queue (8 active)
  insert into public.queue_entries (
    id, organization_id, branch_id, patient_id, appointment_id, display_code, status, chair_label, checked_in_at, called_at
  )
  values
    ('de000201-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000101-0000-4000-8000-000000000001'::uuid, 'Q001', 'in_chair', 'Chair 2', now() - interval '45 minutes', now() - interval '40 minutes'),
    ('de000201-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'de000102-0000-4000-8000-000000000002'::uuid, 'Q002', 'now_serving', null, now() - interval '35 minutes', now() - interval '5 minutes'),
    ('de000201-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid, 'de000103-0000-4000-8000-000000000003'::uuid, 'Q003', 'ready', null, now() - interval '25 minutes', null),
    ('de000201-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid, null, 'Q004', 'waiting', null, now() - interval '20 minutes', null),
    ('de000201-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid, null, 'Q005', 'waiting', null, now() - interval '18 minutes', null),
    ('de000201-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid, null, 'Q006', 'waiting', null, now() - interval '15 minutes', null),
    ('de000201-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, null, 'Q007', 'ready', null, now() - interval '12 minutes', null),
    ('de000201-0000-4000-8000-000000000008'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid, null, 'Q008', 'waiting', null, now() - interval '8 minutes', null)
  on conflict (id) do update set
    status = excluded.status,
    display_code = excluded.display_code,
    chair_label = excluded.chair_label,
    checked_in_at = excluded.checked_in_at,
    called_at = excluded.called_at,
    updated_at = now();

  -- Pending consents
  insert into public.patient_consents (id, patient_id, organization_id, branch_id, template_slug, template_name, status)
  values
    ('de000401-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, v_branch_id, 'dpa-consent', 'Data Privacy Act (DPA) Consent', 'pending'),
    ('de000401-0000-4000-8000-000000000002'::uuid, 'de000002-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'general-treatment', 'General Treatment Consent', 'pending'),
    ('de000401-0000-4000-8000-000000000003'::uuid, 'de000003-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'ortho-agreement', 'Orthodontic Agreement', 'pending')
  on conflict (patient_id, template_slug) do update set
    status = excluded.status,
    branch_id = excluded.branch_id;

  -- Waitlist (if table exists)
  if to_regclass('public.waitlist_entries') is not null then
    insert into public.waitlist_entries (id, organization_id, branch_id, patient_id, status, urgency, preferred_date, notes)
    values
      ('de000501-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, 'waiting', 'urgent', v_manila_today + 1, 'Pain — wants earliest slot'),
      ('de000501-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de00000a-0000-4000-8000-00000000000a'::uuid, 'contacted', 'normal', v_manila_today + 3, 'Callback for cleaning'),
      ('de000501-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de00000b-0000-4000-8000-00000000000b'::uuid, 'waiting', 'normal', v_manila_today + 5, 'Ortho consult — flexible schedule')
    on conflict (id) do update set
      status = excluded.status,
      preferred_date = excluded.preferred_date,
      updated_at = now();
  end if;

  -- Treatment plan
  insert into public.treatment_plans (id, organization_id, branch_id, patient_id, title, status, total_estimated, notes)
  values (
    'de000a01-0000-4000-8000-000000000001'::uuid,
    v_org_id,
    v_branch_id,
    v_patient1,
    'Restorative plan — Maria Santos',
    'proposed',
    18500,
    'Demo treatment plan for showcase'
  )
  on conflict (id) do update set
    title = excluded.title,
    status = excluded.status,
    total_estimated = excluded.total_estimated,
    updated_at = now();

  insert into public.treatment_plan_items (id, plan_id, procedure_id, tooth_number, description, estimated_price, priority, status)
  values
    ('de000a02-0000-4000-8000-000000000001'::uuid, 'de000a01-0000-4000-8000-000000000001'::uuid, v_proc_fill, '36', 'Composite filling #36', 3500, 'restorative', 'planned'),
    ('de000a02-0000-4000-8000-000000000002'::uuid, 'de000a01-0000-4000-8000-000000000001'::uuid, v_proc_proph, null, 'Prophylaxis / Cleaning', 2500, 'restorative', 'planned')
  on conflict (id) do update set
    description = excluded.description,
    estimated_price = excluded.estimated_price;

  -- Invoices (mix open / partial / paid + overdue)
  insert into public.invoices (id, organization_id, branch_id, patient_id, treatment_plan_id, invoice_number, total_amount, paid_amount, status, due_date)
  values
    ('de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000a01-0000-4000-8000-000000000001'::uuid, 'DEMO-INV-001', 8500, 0, 'sent', v_manila_today + 14),
    ('de000301-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, null, 'DEMO-INV-002', 12000, 5000, 'partial', v_manila_today - 3),
    ('de000301-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid, null, 'DEMO-INV-003', 3500, 3500, 'paid', v_manila_today),
    ('de000301-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid, null, 'DEMO-INV-004', 5000, 0, 'draft', v_manila_today + 7),
    ('de000301-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid, null, 'DEMO-INV-005', 15000, 8000, 'partial', v_manila_today - 7),
    ('de000301-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid, null, 'DEMO-INV-006', 2500, 2500, 'paid', v_manila_today)
  on conflict (id) do update set
    total_amount = excluded.total_amount,
    paid_amount = excluded.paid_amount,
    status = excluded.status,
    due_date = excluded.due_date,
    updated_at = now();

  if to_regclass('public.invoice_line_items') is not null then
    insert into public.invoice_line_items (id, invoice_id, organization_id, procedure_id, description, tooth_number, quantity, unit_price, line_total, sort_order)
    values
      ('de000311-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_exam, 'Oral Examination', null, 1, 500, 500, 0),
      ('de000311-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_proph, 'Prophylaxis / Cleaning', null, 1, 2500, 2500, 1),
      ('de000311-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, v_proc_fill, 'Composite Filling', '36', 1, 5500, 5500, 2)
    on conflict (id) do update set
      line_total = excluded.line_total,
      unit_price = excluded.unit_price;
  end if;

  -- Payments today (today_collected KPI)
  insert into public.invoice_payments (id, invoice_id, organization_id, amount, payment_method, notes, created_at)
  values
    ('de000321-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000003'::uuid, v_org_id, 3500, 'gcash', 'Demo payment — full', now() - interval '2 hours'),
    ('de000321-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000006'::uuid, v_org_id, 2500, 'cash', 'Demo payment — cleaning', now() - interval '1 hour'),
    ('de000321-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_org_id, 5000, 'card', 'Demo partial payment', now() - interval '30 minutes')
  on conflict (id) do update set
    amount = excluded.amount,
    created_at = excluded.created_at;

  -- Clinical notes: signed for Maria; completed appts without signed notes for KPI
  insert into public.clinical_notes (
    id, patient_id, organization_id, branch_id, appointment_id, title, subjective, objective, assessment, plan, status, signed_at
  )
  values
    ('de000601-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, v_branch_id, 'de000101-0000-4000-8000-000000000001'::uuid,
      'Routine check-up', 'No complaints', 'Mild plaque #36', 'Gingivitis', 'Prophylaxis + filling', 'signed', now() - interval '1 hour'),
    ('de000601-0000-4000-8000-000000000002'::uuid, 'de000006-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, null,
      'Draft note', 'Sensitivity cold', 'Pending exam', null, null, 'draft', null)
  on conflict (id) do update set
    status = excluded.status,
    signed_at = excluded.signed_at,
    updated_at = now();

  -- Low stock inventory
  insert into public.inventory_items (id, organization_id, branch_id, name, sku, category, unit, quantity_on_hand, min_stock_level, is_active)
  values
    ('de000701-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'Composite resin A2', 'COMP-A2', 'restorative', 'syringe', 2, 5, true),
    ('de000701-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'Nitrile gloves (M)', 'GLV-M', 'consumable', 'box', 1, 10, true),
    ('de000701-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'Prophy paste', 'PROPHY-01', 'preventive', 'jar', 3, 5, true)
  on conflict (id) do update set
    quantity_on_hand = excluded.quantity_on_hand,
    min_stock_level = excluded.min_stock_level,
    updated_at = now();

  -- HMO draft claims
  insert into public.hmo_claims (id, organization_id, branch_id, patient_id, invoice_id, provider_id, claim_number, member_id, claimed_amount, status)
  values
    ('de000801-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'de000301-0000-4000-8000-000000000001'::uuid, v_hmo_provider, 'DEMO-HMO-001', 'MAX-123456', 8500, 'draft'),
    ('de000801-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_hmo_provider, 'DEMO-HMO-002', 'MAX-789012', 12000, 'draft')
  on conflict (id) do update set
    status = excluded.status,
    claimed_amount = excluded.claimed_amount,
    updated_at = now();

  -- PhilHealth pending claims
  insert into public.philhealth_claims (id, organization_id, branch_id, patient_id, philhealth_id, case_rate_code, status, checklist, notes)
  values
    ('de000901-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid, '12-345678901-2', 'PROPH', 'checklist_incomplete', '{"member_id": true, "diagnosis": false}'::jsonb, 'Demo PhilHealth claim'),
    ('de000901-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, '12-987654321-0', 'FILL', 'ready', '{"member_id": true, "diagnosis": true}'::jsonb, 'Ready for sync stub')
  on conflict (id) do update set
    status = excluded.status,
    checklist = excluded.checklist,
    updated_at = now();

  -- Odontogram (when dental_charts + tooth_findings exist)
  if to_regclass('public.dental_charts') is not null and to_regclass('public.tooth_findings') is not null then
    insert into public.dental_charts (id, organization_id, branch_id, patient_id, status)
    values (v_chart_id, v_org_id, v_branch_id, v_patient1, 'active')
    on conflict (id) do update set status = excluded.status, updated_at = now();

    insert into public.tooth_findings (id, chart_id, patient_id, organization_id, branch_id, tooth_number, dentition_type, condition, surfaces, restoration_type, status)
    values
      ('de000c01-0000-4000-8000-000000000001'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '36', 'permanent', 'decayed', array['center','top']::text[], null, 'active'),
      ('de000c01-0000-4000-8000-000000000002'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '26', 'permanent', 'present', array[]::text[], 'composite', 'active'),
      ('de000c01-0000-4000-8000-000000000003'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '46', 'permanent', 'decayed', array['center']::text[], null, 'active'),
      ('de000c01-0000-4000-8000-000000000004'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '11', 'permanent', 'present', array[]::text[], 'jacket_crown', 'active'),
      ('de000c01-0000-4000-8000-000000000005'::uuid, v_chart_id, v_patient1, v_org_id, v_branch_id, '38', 'permanent', 'indicated_extraction', array[]::text[], null, 'active')
    on conflict (id) do update set
      condition = excluded.condition,
      surfaces = excluded.surfaces,
      restoration_type = excluded.restoration_type,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'branch_id', v_branch_id,
    'organization_id', v_org_id,
    'manila_date', v_manila_today,
    'demo_patient_ids', jsonb_build_array(
      v_patient1::text,
      'de000002-0000-4000-8000-000000000002',
      'de000003-0000-4000-8000-000000000003'
    ),
    'hint', 'Set LANDING_SHOWCASE_BRANCH_ID=' || v_branch_id::text || ' in .env.local for public landing previews'
  );
end;
$$;

grant execute on function public.seed_demo_showcase_data(uuid) to authenticated;
grant execute on function public.seed_demo_showcase_data(uuid) to service_role;
