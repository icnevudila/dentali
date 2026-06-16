import { PERMISSIONS } from "@/lib/auth/permissions"

const RECEPTION_ROLES = new Set(["receptionist"])

/** Where staff land after login — front desk goes straight to Queue. */
export function resolvePostLoginPath(opts: {
  roleName: string | null
  permissions: string[]
}): string {
  const { roleName, permissions } = opts
  const permSet = new Set(permissions)
  const hasQueue = permSet.has(PERMISSIONS.QUEUE_MANAGE)
  const hasChair = permSet.has(PERMISSIONS.DENTAL_CHART_READ)
  const isReception = roleName ? RECEPTION_ROLES.has(roleName) : false

  if (hasQueue && (isReception || !hasChair)) {
    return "/queue"
  }

  return "/"
}
