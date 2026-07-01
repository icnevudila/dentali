-- Fix: ortho-agreement consent template had an insufficient one-line body.
-- The signing page was showing "No document text configured for this form."
-- This migration replaces it with a full, professional orthodontic agreement.

update public.consent_templates
set
  name    = 'Orthodontic Treatment Agreement',
  version = '2.0',
  body    = 'ORTHODONTIC TREATMENT AGREEMENT

Clinic: {{clinic_name}}
Patient: {{patient_name}}
Date of Birth: {{patient_dob}}
Date: {{today_date}}

──────────────────────────────────────────────

SCOPE OF TREATMENT

I, the undersigned patient (or parent/guardian of a minor patient), hereby agree to undergo orthodontic treatment as recommended and explained by my orthodontist at {{clinic_name}}. I understand that treatment may involve fixed appliances (braces), removable aligners, retainers, space maintainers, or other orthodontic devices as deemed necessary.

──────────────────────────────────────────────

TREATMENT DURATION

I understand that orthodontic treatment typically takes 12 to 36 months depending on the complexity of my case and my cooperation. The estimated duration provided at the start of treatment is an approximation and is subject to change based on biological response, growth, and compliance.

──────────────────────────────────────────────

PATIENT COOPERATION

I understand that the success of my treatment depends significantly on my cooperation, including:
• Wearing appliances or aligners as instructed
• Keeping all scheduled adjustment appointments
• Maintaining good oral hygiene throughout treatment
• Following dietary restrictions (no hard, sticky, or chewy foods for braces patients)
• Wearing retainers as prescribed after active treatment

Failure to cooperate may extend treatment duration, compromise results, or require termination of treatment.

──────────────────────────────────────────────

RISKS AND LIMITATIONS

I understand that orthodontic treatment involves the following potential risks and limitations, which have been explained to me:

1. Tooth decay and gum disease — plaque accumulates more easily around appliances. Excellent oral hygiene is essential to prevent white spot lesions, cavities, and gingivitis.

2. Root resorption — orthodontic tooth movement may shorten root length. Severe root resorption is rare but may affect long-term tooth stability.

3. Relapse — teeth may shift after treatment if retainers are not worn as prescribed. Lifelong retainer use is recommended.

4. Temporomandibular joint (TMJ) discomfort — mild jaw discomfort may occur during treatment; this is usually temporary.

5. Allergic reactions — some patients may have sensitivities to metals or latex used in orthodontic materials. I will inform the clinic of any known allergies.

6. Treatment limitations — orthodontics cannot correct all skeletal discrepancies without combined surgical intervention.

──────────────────────────────────────────────

FINANCIAL AGREEMENT

I agree to pay the contracted treatment fee as discussed with the clinic. I understand that:
• A down payment is due at banding/appliance placement.
• Monthly adjustment fees are due at each visit.
• Broken appliances, missed appointments, or extended treatment may incur additional charges.
• Fees are non-refundable once active treatment has commenced.

──────────────────────────────────────────────

CONSENT

By proceeding with signing, I confirm that:
• I have read and understood the above agreement.
• The nature, risks, benefits, and alternatives of orthodontic treatment have been explained to me.
• I have had the opportunity to ask questions and all questions were answered to my satisfaction.
• I voluntarily consent to the recommended treatment.

Patient: {{patient_name}} · Date: {{today_date}} · Clinic: {{clinic_name}}'
where organization_id is null
  and slug = 'ortho-agreement';

-- Fix upsert_staff_branch_assignment argument ordering matching client postgrest schema cache
create or replace function public.upsert_staff_branch_assignment(
  p_branch_id uuid,
  p_profile_id uuid,
  p_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_target_org uuid;
  v_branch_org uuid;
  v_role_name text;
  v_is_bootstrap_self boolean := false;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id into v_target_org
  from public.profiles
  where id = p_profile_id;

  select organization_id into v_branch_org
  from public.branches
  where id = p_branch_id;

  select name into v_role_name
  from public.roles
  where id = p_role_id;

  if v_target_org is distinct from v_org or v_branch_org is distinct from v_org or v_role_name is null then
    raise exception 'Invalid staff, branch, or role';
  end if;

  v_is_bootstrap_self :=
    p_profile_id = auth.uid()
    and not exists (
      select 1
      from public.staff_branch_assignments sba
      where sba.branch_id = p_branch_id
    );

  if not v_is_bootstrap_self and not public.has_permission('staff.write', p_branch_id) then
    raise exception 'Unauthorized';
  end if;

  insert into public.staff_branch_assignments (profile_id, branch_id, role_id)
  values (p_profile_id, p_branch_id, p_role_id)
  on conflict (profile_id, branch_id)
  do update set role_id = excluded.role_id;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.upsert_staff_branch_assignment(uuid, uuid, uuid) to authenticated;

-- Reload postgrest schema cache
notify pgrst, 'reload schema';
