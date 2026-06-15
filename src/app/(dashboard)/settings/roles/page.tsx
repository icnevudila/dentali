"use client"

import { useCallback, useEffect, useState } from "react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchRolesWithPermissions } from "@/lib/auth/auth-service"
import type { RoleWithPermissions } from "@/lib/auth/permissions"
import { fetchCallerIsOrgOwner } from "@/lib/auth/role-permissions-service"
import { RolePermissionsEditor } from "@/components/settings/RolePermissionsEditor"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Shield } from "lucide-react"

export default function RolesSettingsPage() {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [callerIsOwner, setCallerIsOwner] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [roleData, isOwner] = await Promise.all([
      fetchRolesWithPermissions(),
      fetchCallerIsOrgOwner(),
    ])
    setRoles(roleData)
    setCallerIsOwner(isOwner)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <PageLoadingSkeleton variant="grid2" />
  }

  return (
    <PermissionGate permission={PERMISSIONS.STAFF_MANAGE}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("settings.rolesEyebrow", "Access") + " · " + t("settings.rolesTitle", "Roles")}
        icon={Shield}
        title={t("settings.rolesTitle", "Roles & Permissions")}
        description={t(
          "settings.rolesSubtitleEditable",
          "Assign what each staff role can do in the clinic. Changes apply on the next login and are enforced server-side."
        )}
        metrics={[
          {
            label: t("settings.metricRoles", "Roles"),
            value: roles.length,
            hint: t("settings.metricRolesHint", "Built-in access levels"),
            icon: Shield,
          },
        ]}
        metricsClassName="lg:grid-cols-1"
        panel={false}
      >
        <RolePermissionsEditor roles={roles} callerIsOwner={callerIsOwner} onSaved={load} />
      </ModulePageShell>
    </PermissionGate>
  )
}
