import { createClient } from "@/lib/supabase/client"

export async function updateRolePermissions(
  roleId: string,
  permissionNames: string[]
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("update_role_permissions", {
    p_role_id: roleId,
    p_permission_names: permissionNames,
  })
  return { error: error?.message ?? null }
}

export async function fetchCallerIsOrgOwner(): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("user_is_org_owner")
  if (error) return false
  return Boolean(data)
}
