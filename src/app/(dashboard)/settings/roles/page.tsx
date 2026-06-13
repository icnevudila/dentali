"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchRolesWithPermissions } from "@/lib/auth/auth-service"
import type { RoleWithPermissions } from "@/lib/auth/permissions"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Shield } from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Clinic Administrator",
  dentist: "Dentist / Provider",
  assistant: "Dental Assistant",
  receptionist: "Receptionist",
}

export default function RolesSettingsPage() {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RoleWithPermissions[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetchRolesWithPermissions().then((data) => {
      setRoles(data)
      setLoading(false)
    })
  }, [])

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
          "settings.rolesSubtitle",
          "Built-in access levels for staff. Permissions are enforced server-side via RLS. Roles shown here are read-only — contact your platform admin to change permission mappings."
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
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {ROLE_LABELS[role.name] ?? role.name}
                    {role.name === "owner" && <Badge variant="danger">Full Access</Badge>}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-500 mb-4">
                  {role.description ?? `${role.permissions.length} permissions assigned`}
                </p>
                <button
                  type="button"
                  className="text-sm font-medium text-primary-600 hover:text-primary-800"
                  onClick={() => setExpanded(expanded === role.id ? null : role.id)}
                >
                  {expanded === role.id ? "Hide permissions" : "View permissions"}
                </button>
                {expanded === role.id && (
                  <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                    {role.permissions.map((perm) => (
                      <li key={perm} className="text-xs font-mono text-neutral-600 bg-neutral-50 px-2 py-1 rounded">
                        {perm}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
