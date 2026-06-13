-- =============================================================================
-- Demo Showcase Seed (Idempotent — tekrar çalıştırılabilir)
-- =============================================================================
-- AMAÇ:
--   Landing /welcome sayfası ve screenshot'lar için klinik veritabanına GERÇEK
--   demo satırları ekler (hastalar, randevular, kuyruk, faturalar, ortho, audit,
--   sigorta, belgeler, intake draft, çok şube, KPI'lar ve tüm modül sayfaları).
--   Frontend mock değil — Supabase tablolarında gerçek kayıtlar.
--
-- NASIL ÇALIŞTIRILIR (Supabase SQL Editor):
--   1. Önce klinik bootstrap yapılmış olmalı (en az bir branch kaydı).
--   2. Bu dosyanın tamamını SQL Editor'a yapıştırıp çalıştırın.
--   3. Sonuçtaki branch_id değerini kopyalayın.
--   4. .env.local dosyanıza ekleyin:
--        LANDING_SHOWCASE_BRANCH_ID=<branch_id>
--   5. Opsiyonel — giriş yapmadan /welcome canlı önizlemesi için:
--        SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
--
-- YENİDEN ÇALIŞTIRMA:
--   Güvenle tekrar çalıştırılabilir. Sabit UUID'ler (de0000xx-...) upsert ile
--   güncellenir; bugünün Asia/Manila randevu tarihleri yenilenir.
--
-- BELİRLİ ŞUBE:
--   select public.seed_demo_showcase_data('BRANCH-UUID-BURAYA');
--
-- SCREENSHOT HASTA ID'LERİ (sabit UUID):
--   Maria Santos (chart/ortho referans): de000001-0000-4000-8000-000000000001
--   Elena Bautista (ortho braces):       de00000b-0000-4000-8000-00000000000b
--   Patricia Villanueva (aligners):      de000007-0000-4000-8000-000000000007
--   Juan Reyes (signed consent):         de000002-0000-4000-8000-000000000002
--
-- DOLU SAYFALAR: dashboard, patients, appointments, queue, waitlist, billing,
--   hmo, philhealth, inventory, reports, closeout, settings/*, patient/*
-- =============================================================================
-- Demo showcase seed â€” idempotent RPC for landing page live previews
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
  v_branch2_id uuid := 'de0000d1-0000-4000-8000-000000000002'::uuid;
  v_branch3_id uuid := 'de0000d1-0000-4000-8000-000000000003'::uuid;
  v_ortho_case1 uuid := 'de000d01-0000-4000-8000-000000000001'::uuid;
  v_ortho_case2 uuid := 'de000d01-0000-4000-8000-000000000002'::uuid;
  v_provider_id uuid;
  v_role_dentist uuid;
  v_role_receptionist uuid;
  v_sig_stub text := 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
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
    raise exception 'No branch found â€” bootstrap a clinic first';
  end if;

  perform public.seed_default_procedures(v_org_id);
  perform public.seed_hmo_providers(v_org_id);

  if to_regprocedure('public.seed_notification_templates(uuid)') is not null then
    perform public.seed_notification_templates(v_org_id);
  end if;

  select r.id into v_role_dentist
  from public.roles r
  where r.name = 'dentist'
  limit 1;

  select r.id into v_role_receptionist
  from public.roles r
  where r.name = 'receptionist'
  limit 1;

  select p.id into v_provider_id
  from public.profiles p
  join public.staff_branch_assignments sba on sba.profile_id = p.id and sba.branch_id = v_branch_id
  join public.roles r on r.id = sba.role_id
  where p.organization_id = v_org_id and r.name in ('dentist', 'owner', 'admin')
  order by case r.name when 'dentist' then 0 when 'owner' then 1 else 2 end
  limit 1;

  if v_provider_id is null then
    select p.id into v_provider_id
    from public.profiles p
    where p.organization_id = v_org_id
    order by p.created_at nulls last
    limit 1;
  end if;

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

  -- Week calendar spread (past + future days for appointments page & analytics)
  insert into public.appointments (id, organization_id, branch_id, patient_id, scheduled_at, duration_minutes, purpose, status)
  values
    ('de000108-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid,
      ((v_manila_today - 1) + time '10:00') at time zone 'Asia/Manila', 30, 'Follow-up cleaning', 'completed'),
    ('de000108-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de00000a-0000-4000-8000-00000000000a'::uuid,
      ((v_manila_today - 2) + time '11:30') at time zone 'Asia/Manila', 45, 'Extraction consult', 'cancelled'),
    ('de000108-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de00000b-0000-4000-8000-00000000000b'::uuid,
      ((v_manila_today - 4) + time '09:00') at time zone 'Asia/Manila', 30, 'Ortho adjustment', 'no_show'),
    ('de000108-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de00000c-0000-4000-8000-00000000000c'::uuid,
      ((v_manila_today - 3) + time '15:00') at time zone 'Asia/Manila', 30, 'Oral exam', 'completed'),
    ('de000108-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_patient1,
      ((v_manila_today + 1) + time '09:30') at time zone 'Asia/Manila', 30, 'Post-op check', 'scheduled'),
    ('de000108-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid,
      ((v_manila_today + 1) + time '14:00') at time zone 'Asia/Manila', 45, 'Filling #46', 'confirmed'),
    ('de000108-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid,
      ((v_manila_today + 2) + time '10:30') at time zone 'Asia/Manila', 30, 'Prophylaxis', 'scheduled'),
    ('de000108-0000-4000-8000-000000000008'::uuid, v_org_id, v_branch_id, 'de000004-0000-4000-8000-000000000004'::uuid,
      ((v_manila_today + 3) + time '11:00') at time zone 'Asia/Manila', 60, 'Root canal', 'confirmed'),
    ('de000108-0000-4000-8000-000000000009'::uuid, v_org_id, v_branch_id, 'de000005-0000-4000-8000-000000000005'::uuid,
      ((v_manila_today + 4) + time '08:30') at time zone 'Asia/Manila', 30, 'Whitening consult', 'scheduled'),
    ('de000108-0000-4000-8000-00000000000a'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid,
      ((v_manila_today - 5) + time '13:00') at time zone 'Asia/Manila', 30, 'Crown delivery', 'completed'),
    ('de000108-0000-4000-8000-00000000000b'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid,
      ((v_manila_today - 6) + time '16:00') at time zone 'Asia/Manila', 30, 'Denture adjustment', 'completed'),
    ('de000108-0000-4000-8000-00000000000c'::uuid, v_org_id, v_branch_id, 'de000006-0000-4000-8000-000000000006'::uuid,
      ((v_manila_today + 5) + time '09:00') at time zone 'Asia/Manila', 30, 'Recall exam', 'scheduled')
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

  -- Consents: pending + signed mix
  insert into public.patient_consents (
    id, patient_id, organization_id, branch_id, template_slug, template_name, status,
    signed_at, signature_data, field_responses, body_snapshot
  )
  values
    ('de000401-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, v_branch_id, 'dpa-consent', 'Data Privacy Act (DPA) Consent', 'pending', null, null, null, null),
    ('de000401-0000-4000-8000-000000000002'::uuid, 'de000002-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'general-treatment', 'General Treatment Consent', 'signed',
      now() - interval '3 days', v_sig_stub,
      '{"emergency_contact": "Juan Reyes / +639171234002", "procedure_acknowledged": true, "questions_answered": true, "patient_initials": "JR"}'::jsonb,
      'General Treatment Consent — signed for showcase demo.'),
    ('de000401-0000-4000-8000-000000000003'::uuid, 'de000003-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'ortho-agreement', 'Orthodontic Agreement', 'pending', null, null, null, null),
    ('de000401-0000-4000-8000-000000000004'::uuid, 'de000004-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'dpa-consent', 'Data Privacy Act (DPA) Consent', 'signed',
      now() - interval '14 days', v_sig_stub, '{}'::jsonb, 'DPA Consent — signed for showcase demo.'),
    ('de000401-0000-4000-8000-000000000005'::uuid, 'de000005-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'general-treatment', 'General Treatment Consent', 'signed',
      now() - interval '7 days', v_sig_stub,
      '{"emergency_contact": "Liza Mendoza / +639171234005", "procedure_acknowledged": true}'::jsonb,
      'General Treatment Consent — signed for showcase demo.'),
    ('de000401-0000-4000-8000-000000000006'::uuid, 'de000006-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, 'dpa-consent', 'Data Privacy Act (DPA) Consent', 'pending', null, null, null, null)
  on conflict (patient_id, template_slug) do update set
    status = excluded.status,
    branch_id = excluded.branch_id,
    signed_at = excluded.signed_at,
    signature_data = excluded.signature_data,
    field_responses = excluded.field_responses,
    body_snapshot = excluded.body_snapshot;

  -- Waitlist (if table exists)
  if to_regclass('public.waitlist_entries') is not null then
    insert into public.waitlist_entries (id, organization_id, branch_id, patient_id, status, urgency, preferred_date, notes)
    values
      ('de000501-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, 'waiting', 'urgent', v_manila_today + 1, 'Pain â€” wants earliest slot'),
      ('de000501-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de00000a-0000-4000-8000-00000000000a'::uuid, 'contacted', 'normal', v_manila_today + 3, 'Callback for cleaning'),
      ('de000501-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de00000b-0000-4000-8000-00000000000b'::uuid, 'waiting', 'normal', v_manila_today + 5, 'Ortho consult â€” flexible schedule')
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
    'Restorative plan â€” Maria Santos',
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
    ('de000321-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000003'::uuid, v_org_id, 3500, 'gcash', 'Demo payment â€” full', now() - interval '2 hours'),
    ('de000321-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000006'::uuid, v_org_id, 2500, 'cash', 'Demo payment â€” cleaning', now() - interval '1 hour'),
    ('de000321-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_org_id, 5000, 'card', 'Demo partial payment', now() - interval '30 minutes'),
    ('de000322-0000-4000-8000-000000000001'::uuid, 'de000301-0000-4000-8000-000000000005'::uuid, v_org_id, 3000, 'gcash', 'Demo payment — day -1', (v_manila_today - 1) + time '17:00'),
    ('de000322-0000-4000-8000-000000000002'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_org_id, 2000, 'cash', 'Demo payment — day -2', (v_manila_today - 2) + time '16:30'),
    ('de000322-0000-4000-8000-000000000003'::uuid, 'de000301-0000-4000-8000-000000000001'::uuid, v_org_id, 1500, 'card', 'Demo payment — day -3', (v_manila_today - 3) + time '15:00'),
    ('de000322-0000-4000-8000-000000000004'::uuid, 'de000301-0000-4000-8000-000000000006'::uuid, v_org_id, 2500, 'gcash', 'Demo payment — day -4', (v_manila_today - 4) + time '12:00'),
    ('de000322-0000-4000-8000-000000000005'::uuid, 'de000301-0000-4000-8000-000000000003'::uuid, v_org_id, 1000, 'cash', 'Demo payment — day -5', (v_manila_today - 5) + time '11:00'),
    ('de000322-0000-4000-8000-000000000006'::uuid, 'de000301-0000-4000-8000-000000000005'::uuid, v_org_id, 4000, 'card', 'Demo payment — day -6', (v_manila_today - 6) + time '14:00'),
    ('de000322-0000-4000-8000-000000000007'::uuid, 'de000301-0000-4000-8000-000000000002'::uuid, v_org_id, 2500, 'gcash', 'Demo payment — day -7', (v_manila_today - 7) + time '10:30')
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

  -- Medical histories (versioned + risk flags)
  if to_regclass('public.patient_medical_histories') is not null then
    insert into public.patient_medical_histories (id, patient_id, organization_id, version, allergies, medications, conditions, notes, created_by)
    values
      ('de000e01-0000-4000-8000-000000000001'::uuid, v_patient1, v_org_id, 1,
        '["Penicillin"]'::jsonb, '["Metformin 500mg"]'::jsonb, '["Type 2 Diabetes"]'::jsonb, 'Initial intake', v_provider_id),
      ('de000e01-0000-4000-8000-000000000002'::uuid, v_patient1, v_org_id, 2,
        '["Penicillin", "Latex"]'::jsonb, '["Metformin 500mg", "Losartan 50mg"]'::jsonb, '["Type 2 Diabetes", "Hypertension"]'::jsonb, 'Updated at recall', v_provider_id),
      ('de000e01-0000-4000-8000-000000000003'::uuid, 'de000002-0000-4000-8000-000000000002'::uuid, v_org_id, 1,
        '[]'::jsonb, '["Amlodipine 5mg"]'::jsonb, '["Hypertension"]'::jsonb, null, v_provider_id),
      ('de000e01-0000-4000-8000-000000000004'::uuid, 'de000008-0000-4000-8000-000000000008'::uuid, v_org_id, 1,
        '["Aspirin"]'::jsonb, '[]'::jsonb, '["Asthma"]'::jsonb, 'PhilHealth member', v_provider_id),
      ('de000e01-0000-4000-8000-000000000005'::uuid, 'de00000b-0000-4000-8000-00000000000b'::uuid, v_org_id, 1,
        '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'No significant history', v_provider_id)
    on conflict (id) do update set
      allergies = excluded.allergies,
      medications = excluded.medications,
      conditions = excluded.conditions,
      notes = excluded.notes;
  end if;

  -- Insurance profiles
  if to_regclass('public.patient_insurance_profiles') is not null then
    insert into public.patient_insurance_profiles (id, organization_id, patient_id, payer_type, payer_name, member_id, plan_name, is_primary, notes)
    values
      ('de001001-0000-4000-8000-000000000001'::uuid, v_org_id, v_patient1, 'hmo', 'Maxicare', 'MAX-123456', 'Executive Plan', true, 'Primary HMO'),
      ('de001001-0000-4000-8000-000000000002'::uuid, v_org_id, 'de000008-0000-4000-8000-000000000008'::uuid, 'philhealth', 'PhilHealth', '12-345678901-2', 'Member', true, 'PhilHealth PROPH case rate'),
      ('de001001-0000-4000-8000-000000000003'::uuid, v_org_id, 'de000004-0000-4000-8000-000000000004'::uuid, 'private', 'Self-pay', null, null, true, 'Cash / card'),
      ('de001001-0000-4000-8000-000000000004'::uuid, v_org_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'hmo', 'Intellicare', 'INT-445566', 'Corporate', true, 'Employer HMO')
    on conflict (patient_id, payer_type) do update set
      payer_name = excluded.payer_name,
      member_id = excluded.member_id,
      plan_name = excluded.plan_name,
      notes = excluded.notes,
      updated_at = now();
  end if;

  -- Patient documents (metadata — preview needs storage upload separately)
  if to_regclass('public.patient_documents') is not null then
    insert into public.patient_documents (id, organization_id, branch_id, patient_id, file_name, file_type, file_size, storage_path, category, notes, uploaded_by)
    values
      ('de000f01-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'panoramic-xray-2026.jpg', 'image/jpeg', 245000,
        v_org_id::text || '/' || v_patient1::text || '/panoramic-xray-2026.jpg', 'xray', 'Initial panoramic', v_provider_id),
      ('de000f01-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_patient1, 'valid-id.jpg', 'image/jpeg', 120000,
        v_org_id::text || '/' || v_patient1::text || '/valid-id.jpg', 'id', 'Government ID on file', v_provider_id),
      ('de000f01-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'periapical-36.png', 'image/png', 89000,
        v_org_id::text || '/de000002-0000-4000-8000-000000000002/periapical-36.png', 'xray', 'Tooth #36 PA', v_provider_id),
      ('de000f01-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000008-0000-4000-8000-000000000008'::uuid, 'hmo-letter.pdf', 'application/pdf', 56000,
        v_org_id::text || '/de000008-0000-4000-8000-000000000008/hmo-letter.pdf', 'insurance', 'LOA from HMO', v_provider_id),
      ('de000f01-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, 'referral-endo.pdf', 'application/pdf', 42000,
        v_org_id::text || '/de000007-0000-4000-8000-000000000007/referral-endo.pdf', 'referral', 'Endo referral', v_provider_id)
    on conflict (id) do update set
      file_name = excluded.file_name,
      category = excluded.category,
      notes = excluded.notes;
  end if;

  -- Ortho cases + adjustment timeline
  if to_regclass('public.ortho_cases') is not null then
    insert into public.ortho_cases (id, organization_id, branch_id, patient_id, status, appliance_type, start_date, contract_amount, notes, created_by)
    values
      (v_ortho_case1, v_org_id, v_branch_id, 'de00000b-0000-4000-8000-00000000000b'::uuid, 'active', 'Metal braces', v_manila_today - 180, 85000, '18-month contract — showcase', v_provider_id),
      (v_ortho_case2, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, 'active', 'Clear aligners', v_manila_today - 90, 120000, 'Invisalign-style plan', v_provider_id)
    on conflict (id) do update set
      status = excluded.status,
      contract_amount = excluded.contract_amount,
      notes = excluded.notes,
      updated_at = now();

    insert into public.ortho_adjustments (id, organization_id, branch_id, case_id, adjustment_date, procedure, next_procedure, next_visit_date, payment_amount, notes, created_by)
    values
      ('de000d02-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_ortho_case1, v_manila_today - 60, 'Wire change U/L', 'Elastic training', v_manila_today - 30, 3500, null, v_provider_id),
      ('de000d02-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_ortho_case1, v_manila_today - 30, 'Elastic training', 'Wire change', v_manila_today, 3500, null, v_provider_id),
      ('de000d02-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, v_ortho_case1, v_manila_today - 7, 'Monthly adjustment', 'Wire change', v_manila_today + 21, 3500, 'Good cooperation', v_provider_id),
      ('de000d02-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, v_ortho_case2, v_manila_today - 45, 'Aligner set #3', 'Aligner set #4', v_manila_today - 15, 8000, null, v_provider_id),
      ('de000d02-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_ortho_case2, v_manila_today - 15, 'Aligner set #4', 'Aligner set #5', v_manila_today + 15, 8000, null, v_provider_id),
      ('de000d02-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, v_ortho_case2, v_manila_today - 1, 'IPR #12-22', 'Aligner set #5', v_manila_today + 14, 0, 'Minor IPR', v_provider_id)
    on conflict (id) do update set
      procedure = excluded.procedure,
      payment_amount = excluded.payment_amount,
      adjustment_date = excluded.adjustment_date;
  end if;

  -- Kiosk intake drafts (patients page panel)
  if to_regclass('public.patient_intakes') is not null then
    insert into public.patient_intakes (id, organization_id, branch_id, patient_id, status, payload, created_at)
    values
      ('de001301-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, null, 'draft',
        '{"first_name": "Sofia", "last_name": "Navarro", "phone": "+639178880001", "email": "sofia.n@example.ph", "date_of_birth": "1997-04-12", "medical_alerts": "Latex allergy"}'::jsonb,
        now() - interval '2 hours'),
      ('de001301-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, null, 'draft',
        '{"first_name": "Rafael", "last_name": "Lim", "phone": "+639178880002", "gender": "male", "address": "BGC, Taguig"}'::jsonb,
        now() - interval '45 minutes'),
      ('de001301-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, null, 'draft',
        '{"first_name": "Grace", "last_name": "Tan", "phone": "+639178880003", "purpose": "Walk-in toothache"}'::jsonb,
        now() - interval '20 minutes'),
      ('de001301-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, null, 'draft',
        '{"first_name": "Kevin", "last_name": "Ong", "phone": "+639178880004", "referral": "Ortho consult"}'::jsonb,
        now() - interval '10 minutes')
    on conflict (id) do update set
      payload = excluded.payload,
      status = excluded.status;
  end if;

  -- Audit trail (settings/audit + analytics)
  if to_regclass('public.organization_audit_logs') is not null then
    insert into public.organization_audit_logs (id, organization_id, branch_id, profile_id, action, entity_type, entity_id, metadata, created_at)
    values
      ('de001101-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_provider_id, 'patient.create', 'patient', v_patient1::text, '{"source": "demo_seed"}'::jsonb, now() - interval '6 days'),
      ('de001101-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_provider_id, 'appointment.check_in', 'appointment', 'de000103-0000-4000-8000-000000000003', '{}'::jsonb, now() - interval '25 minutes'),
      ('de001101-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, v_provider_id, 'invoice.payment', 'invoice', 'de000301-0000-4000-8000-000000000003', '{"amount": 3500, "method": "gcash"}'::jsonb, now() - interval '2 hours'),
      ('de001101-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, v_provider_id, 'consent.signed', 'patient_consent', 'de000401-0000-4000-8000-000000000002', '{"template": "general-treatment"}'::jsonb, now() - interval '3 days'),
      ('de001101-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_provider_id, 'inventory.adjust', 'inventory_item', 'de000701-0000-4000-8000-000000000001', '{"delta": -1}'::jsonb, now() - interval '1 day'),
      ('de001101-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, v_provider_id, 'treatment_plan.create', 'treatment_plan', 'de000a01-0000-4000-8000-000000000001', '{}'::jsonb, now() - interval '5 days'),
      ('de001101-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, v_provider_id, 'hmo_claim.draft', 'hmo_claim', 'de000801-0000-4000-8000-000000000001', '{}'::jsonb, now() - interval '4 days'),
      ('de001101-0000-4000-8000-000000000008'::uuid, v_org_id, v_branch_id, v_provider_id, 'queue.check_in', 'queue_entry', 'de000201-0000-4000-8000-000000000004', '{}'::jsonb, now() - interval '20 minutes'),
      ('de001101-0000-4000-8000-000000000009'::uuid, v_org_id, v_branch_id, v_provider_id, 'patient.update', 'patient', 'de000003-0000-4000-8000-000000000003'::text, '{"field": "phone"}'::jsonb, now() - interval '2 days'),
      ('de001101-0000-4000-8000-00000000000a'::uuid, v_org_id, v_branch_id, v_provider_id, 'clinical_note.sign', 'clinical_note', 'de000601-0000-4000-8000-000000000001', '{}'::jsonb, now() - interval '1 hour')
    on conflict (id) do update set
      action = excluded.action,
      metadata = excluded.metadata,
      created_at = excluded.created_at;
  end if;

  if to_regclass('public.session_audit_logs') is not null and v_provider_id is not null then
    insert into public.session_audit_logs (id, profile_id, organization_id, event_type, ip_address, created_at)
    values
      ('de001102-0000-4000-8000-000000000001'::uuid, v_provider_id, v_org_id, 'login', '203.177.0.1', now() - interval '8 hours'),
      ('de001102-0000-4000-8000-000000000002'::uuid, v_provider_id, v_org_id, 'logout', '203.177.0.1', now() - interval '7 hours'),
      ('de001102-0000-4000-8000-000000000003'::uuid, v_provider_id, v_org_id, 'login', '203.177.0.1', now() - interval '30 minutes')
    on conflict (id) do update set
      event_type = excluded.event_type,
      created_at = excluded.created_at;
  end if;

  -- Notification logs (settings/notifications)
  if to_regclass('public.notification_logs') is not null then
    insert into public.notification_logs (id, organization_id, branch_id, patient_id, template_key, recipient_phone, body_preview, status, created_at)
    values
      ('de001201-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_patient1, 'appointment_reminder_24h', '+639171234001', 'Reminder: appt tomorrow 9:00 AM at Dentali.', 'delivered', now() - interval '1 day'),
      ('de001201-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'de000002-0000-4000-8000-000000000002'::uuid, 'appointment_reminder_2h', '+639171234002', 'Your appointment is in 2 hours.', 'sent', now() - interval '3 hours'),
      ('de001201-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'de000003-0000-4000-8000-000000000003'::uuid, 'payment_receipt', '+639171234003', 'Payment received: PHP 3,500. Thank you!', 'delivered', now() - interval '2 hours'),
      ('de001201-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, 'de000009-0000-4000-8000-000000000009'::uuid, 'waitlist_slot', '+639171234009', 'A slot opened Thu 2pm — reply YES to book.', 'failed', now() - interval '5 hours'),
      ('de001201-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, 'de000007-0000-4000-8000-000000000007'::uuid, 'appointment_reminder_24h', '+639171234007', 'Reminder: crown prep tomorrow.', 'dry_run', now() - interval '12 hours'),
      ('de001201-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, v_patient1, 'consent_signing_link', '+639171234001', 'Sign your consent: https://dentali.ph/sign/demo', 'sent', now() - interval '6 hours')
    on conflict (id) do update set
      status = excluded.status,
      body_preview = excluded.body_preview,
      created_at = excluded.created_at;
  end if;

  -- Staff invitations (settings/staff pending section)
  if to_regclass('public.staff_invitations') is not null and v_role_dentist is not null then
    insert into public.staff_invitations (id, organization_id, branch_id, role_id, email, full_name, status, invited_by)
    values
      ('de001401-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_role_dentist, 'dr.santos.demo@example.ph', 'Dr. Paolo Santos', 'pending', v_provider_id),
      ('de001401-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, coalesce(v_role_receptionist, v_role_dentist), 'reception.demo@example.ph', 'Aira Mendoza', 'pending', v_provider_id)
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      status = excluded.status;
  end if;

  -- Extra branches + clinic hours (multi-branch settings & benchmark)
  insert into public.branches (id, organization_id, name, address, contact_number, is_active)
  values
    (v_branch2_id, v_org_id, 'Dentali Makati Branch', 'Ayala Ave, Makati City, Metro Manila', '+63288123456', true),
    (v_branch3_id, v_org_id, 'Dentali QC Branch', 'Timog Ave, Quezon City, Metro Manila', '+63289876543', true)
  on conflict (id) do update set
    name = excluded.name,
    address = excluded.address,
    contact_number = excluded.contact_number,
    is_active = excluded.is_active,
    updated_at = now();

  if to_regprocedure('public.ensure_branch_clinic_hours(uuid)') is not null then
    perform public.ensure_branch_clinic_hours(v_branch_id);
    perform public.ensure_branch_clinic_hours(v_branch2_id);
    perform public.ensure_branch_clinic_hours(v_branch3_id);
  end if;

  if to_regclass('public.clinic_hours') is not null then
    insert into public.clinic_hours (branch_id, day_of_week, open_time, close_time, is_closed)
    values
      (v_branch_id, 6, '09:00'::time, '13:00'::time, false)
    on conflict (branch_id, day_of_week) do update set
      open_time = excluded.open_time,
      close_time = excluded.close_time,
      is_closed = excluded.is_closed;
  end if;

  -- Branch 2 sample appointments for benchmark
  insert into public.appointments (id, organization_id, branch_id, patient_id, scheduled_at, duration_minutes, purpose, status)
  values
    ('de001601-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch2_id, 'de000009-0000-4000-8000-000000000009'::uuid,
      (v_manila_today + time '10:00') at time zone 'Asia/Manila', 30, 'Makati — cleaning', 'scheduled'),
    ('de001601-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch2_id, 'de00000a-0000-4000-8000-00000000000a'::uuid,
      (v_manila_today + time '11:00') at time zone 'Asia/Manila', 45, 'Makati — extraction', 'confirmed'),
    ('de001601-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch3_id, 'de00000c-0000-4000-8000-00000000000c'::uuid,
      (v_manila_today + time '14:30') at time zone 'Asia/Manila', 30, 'QC — check-up', 'scheduled')
  on conflict (id) do update set
    scheduled_at = excluded.scheduled_at,
    status = excluded.status;

  -- Provider availability grid (appointments page)
  if to_regclass('public.provider_availability') is not null and v_provider_id is not null then
    insert into public.provider_availability (id, organization_id, branch_id, provider_id, day_of_week, start_time, end_time, slot_minutes, is_available)
    values
      ('de001701-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_provider_id, 1, '09:00', '18:00', 30, true),
      ('de001701-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_provider_id, 2, '09:00', '18:00', 30, true),
      ('de001701-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, v_provider_id, 3, '09:00', '18:00', 30, true),
      ('de001701-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, v_provider_id, 4, '09:00', '18:00', 30, true),
      ('de001701-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_provider_id, 5, '09:00', '17:00', 30, true),
      ('de001701-0000-4000-8000-000000000006'::uuid, v_org_id, v_branch_id, v_provider_id, 6, '09:00', '13:00', 30, true),
      ('de001701-0000-4000-8000-000000000007'::uuid, v_org_id, v_branch_id, v_provider_id, 0, '09:00', '12:00', 30, false)
    on conflict (branch_id, provider_id, day_of_week) do update set
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_available = excluded.is_available;
  end if;

  -- Closeout history (reports/closeout)
  if to_regclass('public.closeout_snapshots') is not null then
    insert into public.closeout_snapshots (id, organization_id, branch_id, snapshot_date, payload, created_by, created_at)
    values
      ('de001501-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, v_manila_today - 1,
        jsonb_build_object('appointments_completed', 8, 'collected', 18500, 'open_invoices', 4), v_provider_id, (v_manila_today - 1) + time '18:30'),
      ('de001501-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, v_manila_today - 2,
        jsonb_build_object('appointments_completed', 6, 'collected', 12200, 'open_invoices', 5), v_provider_id, (v_manila_today - 2) + time '18:15'),
      ('de001501-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, v_manila_today - 3,
        jsonb_build_object('appointments_completed', 9, 'collected', 21000, 'open_invoices', 3), v_provider_id, (v_manila_today - 3) + time '18:45'),
      ('de001501-0000-4000-8000-000000000004'::uuid, v_org_id, v_branch_id, v_manila_today - 4,
        jsonb_build_object('appointments_completed', 5, 'collected', 9800, 'open_invoices', 6), v_provider_id, (v_manila_today - 4) + time '18:00'),
      ('de001501-0000-4000-8000-000000000005'::uuid, v_org_id, v_branch_id, v_manila_today - 5,
        jsonb_build_object('appointments_completed', 7, 'collected', 15600, 'open_invoices', 4), v_provider_id, (v_manila_today - 5) + time '18:20')
    on conflict (id) do update set
      payload = excluded.payload,
      snapshot_date = excluded.snapshot_date;
  end if;

  -- Well-stocked inventory alongside low-stock items
  insert into public.inventory_items (id, organization_id, branch_id, name, sku, category, unit, quantity_on_hand, min_stock_level, is_active)
  values
    ('de000702-0000-4000-8000-000000000001'::uuid, v_org_id, v_branch_id, 'Dental mirrors', 'MIR-01', 'instrument', 'pc', 24, 10, true),
    ('de000702-0000-4000-8000-000000000002'::uuid, v_org_id, v_branch_id, 'Anesthetic cartridges', 'ANES-2', 'anesthetic', 'box', 18, 8, true),
    ('de000702-0000-4000-8000-000000000003'::uuid, v_org_id, v_branch_id, 'Face masks', 'MASK-3', 'consumable', 'box', 15, 5, true)
  on conflict (id) do update set
    quantity_on_hand = excluded.quantity_on_hand,
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
      'de000003-0000-4000-8000-000000000003',
      'de00000b-0000-4000-8000-00000000000b',
      'de000007-0000-4000-8000-000000000007'
    ),
    'demo_branch_ids', jsonb_build_array(v_branch_id::text, v_branch2_id::text, v_branch3_id::text),
    'modules_seeded', jsonb_build_array(
      'patients', 'appointments', 'queue', 'waitlist', 'consents', 'treatment_plans',
      'invoices', 'payments', 'clinical_notes', 'inventory', 'hmo', 'philhealth',
      'odontogram', 'medical_history', 'insurance', 'documents', 'ortho', 'intakes',
      'audit', 'notifications', 'staff_invitations', 'branches', 'provider_availability', 'closeout'
    ),
    'hint', 'Set LANDING_SHOWCASE_BRANCH_ID=' || v_branch_id::text || ' in .env.local for public landing previews'
  );
end;
$$;

grant execute on function public.seed_demo_showcase_data(uuid) to authenticated;
grant execute on function public.seed_demo_showcase_data(uuid) to service_role;

select public.seed_demo_showcase_data(null);

