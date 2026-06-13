import { createClient } from "@/lib/supabase/client"
import type { BranchRecord, OrganizationRecord, RoleWithPermissions } from "@/lib/auth/permissions"

export async function fetchMyPermissions(branchId: string | null): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_my_permissions", {
    p_branch_id: branchId,
  })

  if (error) {
    console.error("get_my_permissions failed:", error.message)
    return []
  }

  return (data ?? []) as string[]
}

export async function fetchMyBranches(): Promise<BranchRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_my_branches")

  if (error) {
    console.error("get_my_branches failed:", error.message)
    return []
  }

  return (data ?? []) as BranchRecord[]
}

export async function fetchOrganization(): Promise<OrganizationRecord | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) return null

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, logo_url, timezone, address, contact_number, slug, status, plan_tier")
    .eq("id", profile.organization_id)
    .maybeSingle()

  if (error || !data) {
    console.error("fetchOrganization failed:", error?.message)
    return null
  }

  return data as OrganizationRecord
}

export async function updateOrganization(
  orgId: string,
  payload: Pick<OrganizationRecord, "name" | "address" | "contact_number">
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("organizations")
    .update({
      name: payload.name,
      address: payload.address,
      contact_number: payload.contact_number,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId)

  return { error: error?.message ?? null }
}

export async function fetchRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const supabase = createClient()

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id, name, description")
    .order("name")

  if (rolesError || !roles) {
    console.error("fetchRoles failed:", rolesError?.message)
    return []
  }

  const { data: rolePermissions, error: rpError } = await supabase
    .from("role_permissions")
    .select("role_id, permissions(name)")

  if (rpError) {
    console.error("fetchRolePermissions failed:", rpError.message)
    return roles.map((r) => ({ ...r, permissions: [] }))
  }

  const permMap = new Map<string, string[]>()
  for (const row of rolePermissions ?? []) {
    const roleId = row.role_id as string
    const perm = row.permissions as { name: string } | { name: string }[] | null
    const permName = Array.isArray(perm) ? perm[0]?.name : perm?.name
    if (!permName) continue
    const list = permMap.get(roleId) ?? []
    list.push(permName)
    permMap.set(roleId, list)
  }

  return roles.map((role) => ({
    ...role,
    permissions: (permMap.get(role.id) ?? []).sort(),
  }))
}

export async function logSessionEvent(eventType: "login" | "logout"): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()

  await supabase.from("session_audit_logs").insert({
    profile_id: user.id,
    organization_id: profile?.organization_id ?? null,
    event_type: eventType,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  })
}

export async function bootstrapClinic(
  orgName: string,
  branchName = "Main Clinic"
): Promise<{ status: string; organization_id?: string; branch_id?: string; error?: string }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("bootstrap_clinic", {
    p_org_name: orgName,
    p_branch_name: branchName,
  })

  if (error) return { status: "error", error: error.message }
  return data as { status: string; organization_id?: string; branch_id?: string }
}

export async function completeOnboarding(params: {
  orgName: string
  branchName: string
  branchAddress?: string
  branchPhone?: string
  ownerName?: string
}): Promise<{ error: string | null; branchId?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const bootstrap = await bootstrapClinic(params.orgName, params.branchName)
  if (bootstrap.status === "created" && bootstrap.branch_id) {
    if (params.branchAddress || params.branchPhone) {
      const { updateBranch } = await import("@/lib/org/branch-service")
      await updateBranch(bootstrap.branch_id, {
        name: params.branchName,
        address: params.branchAddress ?? null,
        contact_number: params.branchPhone ?? null,
      })
    }
    if (params.ownerName?.trim()) {
      await supabase.from("profiles").update({ full_name: params.ownerName.trim() }).eq("id", user.id)
    }
    return { error: null, branchId: bootstrap.branch_id }
  }

  if (bootstrap.status !== "already_bootstrapped") {
    return { error: bootstrap.error ?? "Setup failed" }
  }

  let org = await fetchOrganization()
  if (!org) return { error: "Organization not found. Contact support." }

  await updateOrganization(org.id, {
    name: params.orgName,
    address: org.address,
    contact_number: org.contact_number,
  })

  const { createBranch } = await import("@/lib/org/branch-service")
  const { data: branch, error: branchError } = await createBranch({
    name: params.branchName,
    address: params.branchAddress,
    contact_number: params.branchPhone,
    organization_id: org.id,
  })
  if (branchError || !branch) return { error: branchError ?? "Failed to create branch" }

  const { data: staffRow } = await supabase
    .from("staff_profiles")
    .select("profile_id")
    .eq("profile_id", user.id)
    .maybeSingle()
  if (!staffRow) {
    await supabase.from("staff_profiles").insert({ profile_id: user.id })
  }

  const { data: ownerRole } = await supabase.from("roles").select("id").eq("name", "owner").limit(1).maybeSingle()
  const roleId = ownerRole?.id
  if (!roleId) return { error: "Owner role not configured" }

  const { upsertStaffAssignment } = await import("@/lib/staff/staff-service")
  const { error: assignError } = await upsertStaffAssignment(user.id, branch.id, roleId)
  if (assignError) return { error: assignError }

  if (params.ownerName?.trim()) {
    await supabase.from("profiles").update({ full_name: params.ownerName.trim() }).eq("id", user.id)
  }

  if (params.branchAddress || params.branchPhone) {
    const { updateBranch } = await import("@/lib/org/branch-service")
    await updateBranch(branch.id, {
      name: params.branchName,
      address: params.branchAddress ?? null,
      contact_number: params.branchPhone ?? null,
    })
  }

  return { error: null, branchId: branch.id }
}

export async function acceptStaffInvitation(): Promise<{
  status: string
  branch_id?: string
  error?: string
}> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("accept_staff_invitation")
  if (error) return { status: "error", error: error.message }
  const result = data as { status: string; branch_id?: string }
  return { status: result?.status ?? "unknown", branch_id: result?.branch_id }
}

export async function fetchStaffProfile(): Promise<{
  is_active: boolean
  full_name: string | null
  email: string | null
} | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle()

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("is_active")
    .eq("profile_id", user.id)
    .maybeSingle()

  return {
    is_active: staff?.is_active ?? true,
    full_name: profile?.full_name ?? null,
    email: profile?.email ?? user.email ?? null,
  }
}
