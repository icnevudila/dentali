import { createClient } from "@/lib/supabase/client"

export interface StaffMember {
  profile_id: string
  full_name: string | null
  email: string | null
  is_active: boolean
  role_name: string
  branch_names: string[]
  phone_number: string | null
  is_owner_or_admin: boolean
}

export interface OwnerDigestReadiness {
  workflow_enabled: boolean
  owner_admin_count: number
  with_phone_count: number
  missing_phone_count: number
  ready: boolean
  reason?: string
}

export async function fetchOrgStaff(): Promise<{
  data: StaffMember[]
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_org_staff")

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as StaffMember[], error: null }
}

export async function deactivateStaff(
  profileId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("staff_profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("profile_id", profileId)

  return { error: error?.message ?? null }
}

export async function reactivateStaff(
  profileId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("staff_profiles")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("profile_id", profileId)

  return { error: error?.message ?? null }
}

export interface StaffAssignment {
  branch_id: string
  branch_name: string
  role_id: string
  role_name: string
}

export interface StaffMemberDetail {
  profile_id: string
  full_name: string | null
  email: string | null
  is_active: boolean
  phone_number: string | null
  specialization: string | null
  assignments: StaffAssignment[]
  is_owner_or_admin: boolean
}

export async function getStaffMember(
  profileId: string
): Promise<{ data: StaffMemberDetail | null; error: string | null }> {
  const supabase = createClient()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", profileId)
    .maybeSingle()

  if (profileError || !profile) {
    return { data: null, error: profileError?.message ?? "Staff not found" }
  }

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("is_active, phone_number, specialization")
    .eq("profile_id", profileId)
    .maybeSingle()

  const { data: rows, error: assignError } = await supabase
    .from("staff_branch_assignments")
    .select("branch_id, role_id, branches(name), roles(name)")
    .eq("profile_id", profileId)

  if (assignError) return { data: null, error: assignError.message }

  const assignments: StaffAssignment[] = (rows ?? []).map((row) => {
    const branch = row.branches as { name: string } | { name: string }[] | null
    const role = row.roles as { name: string } | { name: string }[] | null
    const b = Array.isArray(branch) ? branch[0] : branch
    const r = Array.isArray(role) ? role[0] : role
    return {
      branch_id: row.branch_id,
      branch_name: b?.name ?? "Branch",
      role_id: row.role_id,
      role_name: r?.name ?? "staff",
    }
  })

  const isOwnerOrAdmin = assignments.some((a) =>
    ["owner", "admin"].includes(a.role_name)
  )

  return {
    data: {
      profile_id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      is_active: staff?.is_active ?? true,
      phone_number: staff?.phone_number?.trim() || null,
      specialization: staff?.specialization?.trim() || null,
      assignments,
      is_owner_or_admin: isOwnerOrAdmin,
    },
    error: null,
  }
}

export async function updateStaffProfile(params: {
  profileId: string
  phoneNumber?: string | null
  specialization?: string | null
}): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { data: existing } = await supabase
    .from("staff_profiles")
    .select("profile_id")
    .eq("profile_id", params.profileId)
    .maybeSingle()

  const payload = {
    phone_number: params.phoneNumber?.trim() || null,
    specialization: params.specialization?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase
      .from("staff_profiles")
      .update(payload)
      .eq("profile_id", params.profileId)
    return { error: error?.message ?? null }
  }

  const { error } = await supabase.from("staff_profiles").insert({
    profile_id: params.profileId,
    is_active: true,
    ...payload,
  })
  return { error: error?.message ?? null }
}

export async function fetchOwnerDigestReadiness(
  branchId: string
): Promise<{ data: OwnerDigestReadiness | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_owner_digest_readiness", {
    p_branch_id: branchId,
  })
  if (error) return { data: null, error: error.message }
  return { data: (data ?? null) as OwnerDigestReadiness | null, error: null }
}

export async function upsertStaffAssignment(
  profileId: string,
  branchId: string,
  roleId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("staff_branch_assignments").upsert(
    { profile_id: profileId, branch_id: branchId, role_id: roleId },
    { onConflict: "profile_id,branch_id" }
  )
  return { error: error?.message ?? null }
}

export async function removeStaffAssignment(
  profileId: string,
  branchId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("staff_branch_assignments")
    .delete()
    .eq("profile_id", profileId)
    .eq("branch_id", branchId)
  return { error: error?.message ?? null }
}

export async function fetchRolesList(): Promise<{ id: string; name: string }[]> {
  const supabase = createClient()
  const { data } = await supabase.from("roles").select("id, name").order("name")
  return data ?? []
}

export interface StaffInvitation {
  id: string
  email: string
  full_name: string | null
  status: string
  created_at: string
  branch_id: string
  role_id: string
}

export async function fetchPendingInvitations(): Promise<{
  data: StaffInvitation[]
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("staff_invitations")
    .select("id, email, full_name, status, created_at, branch_id, role_id")
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as StaffInvitation[], error: null }
}

export async function inviteStaffMember(params: {
  email: string
  fullName: string
  branchId: string
  roleId: string
}): Promise<{ error: string | null; invitationId?: string }> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("invite-staff", {
    body: {
      email: params.email,
      full_name: params.fullName,
      branch_id: params.branchId,
      role_id: params.roleId,
    },
  })

  if (error) return { error: error.message }
  if (data?.error) return { error: String(data.error) }
  return { error: null, invitationId: data?.invitation_id as string | undefined }
}

export async function revokeStaffInvitation(
  invitationId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("revoke_staff_invitation", {
    p_invitation_id: invitationId,
  })
  return { error: error?.message ?? null }
}

export async function addStaffMemberDirectly(params: {
  email: string
  fullName: string
  branchId: string
  roleId: string
  phoneNumber?: string
  specialization?: string
}): Promise<{ error: string | null; profileId?: string }> {
  const supabase = createClient()
  const newProfileId = crypto.randomUUID()
  
  // 1. Insert into profiles
  const { error: profileError } = await supabase.from("profiles").insert({
    id: newProfileId,
    full_name: params.fullName,
    email: params.email
  })
  if (profileError) return { error: profileError.message }

  // 2. Insert into staff_profiles
  const { error: staffError } = await supabase.from("staff_profiles").insert({
    profile_id: newProfileId,
    is_active: true,
    phone_number: params.phoneNumber || null,
    specialization: params.specialization || null
  })
  if (staffError) return { error: staffError.message }

  // 3. Insert into staff_branch_assignments
  const { error: assignError } = await supabase.from("staff_branch_assignments").insert({
    profile_id: newProfileId,
    branch_id: params.branchId,
    role_id: params.roleId
  })
  if (assignError) return { error: assignError.message }

  return { error: null, profileId: newProfileId }
}
