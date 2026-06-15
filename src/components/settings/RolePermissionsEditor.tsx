"use client"

import * as React from "react"
import { Lock, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
import type { RoleWithPermissions } from "@/lib/auth/permissions"
import {
  isRoleEditable,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABEL_FALLBACKS,
  ROLE_LABEL_KEYS,
} from "@/lib/auth/permission-catalog"
import { updateRolePermissions } from "@/lib/auth/role-permissions-service"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface RolePermissionsEditorProps {
  roles: RoleWithPermissions[]
  callerIsOwner: boolean
  onSaved: () => void
}

export function RolePermissionsEditor({ roles, callerIsOwner, onSaved }: RolePermissionsEditorProps) {
  const { t } = useLocale()
  const [selectedRoleId, setSelectedRoleId] = React.useState(roles[0]?.id ?? "")
  const [draft, setDraft] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0]
  const editable = selectedRole ? isRoleEditable(selectedRole.name, callerIsOwner) : false

  React.useEffect(() => {
    if (!selectedRole) return
    setDraft(new Set(selectedRole.permissions))
  }, [selectedRole])

  const roleLabel = (name: string) =>
    t(ROLE_LABEL_KEYS[name] ?? name, ROLE_LABEL_FALLBACKS[name] ?? name)

  const togglePermission = (perm: string) => {
    if (!editable) return
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedRole || !editable) return
    setSaving(true)
    const { error } = await updateRolePermissions(selectedRole.id, Array.from(draft).sort())
    setSaving(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("settings.rolePermissionsSaved", "Role permissions updated"))
      onSaved()
    }
  }

  const dirty =
    selectedRole &&
    (draft.size !== selectedRole.permissions.length ||
      selectedRole.permissions.some((p) => !draft.has(p)))

  if (!selectedRole) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedRoleId(role.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              role.id === selectedRole.id
                ? "border-primary-300 bg-primary-50 text-primary-800"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            )}
          >
            {roleLabel(role.name)}
            {role.name === "owner" ? (
              <Badge variant="danger" className="ml-2 text-[10px]">
                {t("settings.roleFullAccess", "Full access")}
              </Badge>
            ) : null}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{roleLabel(selectedRole.name)}</CardTitle>
            <p className="text-sm text-neutral-500">
              {selectedRole.description ??
                t("settings.rolePermCount", "{count} permissions").replace(
                  "{count}",
                  String(selectedRole.permissions.length)
                )}
            </p>
          </div>
          {editable ? (
            <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void handleSave()}>
              <Save className="h-4 w-4 mr-1.5" aria-hidden />
              {saving ? t("settings.saving", "Saving…") : t("settings.saveChanges", "Save Changes")}
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {selectedRole.name === "owner"
                ? t("settings.roleOwnerLocked", "Owner always has full access")
                : t("settings.roleAdminLocked", "Only the owner can edit administrator permissions")}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6 border-t border-neutral-100 pt-4">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                {t(group.labelKey, group.labelFallback)}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.permissions.map((perm) => {
                  const checked = draft.has(perm)
                  return (
                    <li key={perm}>
                      <label
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                          editable ? "cursor-pointer hover:bg-neutral-50" : "opacity-80",
                          checked ? "border-primary-200 bg-primary-50/40" : "border-neutral-200"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          disabled={!editable}
                          onChange={() => togglePermission(perm)}
                        />
                        <span>
                          <span className="font-medium text-neutral-800">
                            {t(`settings.perm.${perm}`, PERMISSION_LABELS[perm])}
                          </span>
                          <span className="block text-[11px] font-mono text-neutral-400">{perm}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
