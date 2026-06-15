"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import {
  deactivateStaff,
  fetchOrgStaff,
  fetchPendingInvitations,
  fetchRolesList,
  reactivateStaff,
  revokeStaffInvitation,
  type StaffInvitation,
  type StaffMember,
} from "@/lib/staff/staff-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Users, UserPlus } from "lucide-react"
import { ProviderAvailabilityPanel } from "@/components/appointments/ProviderAvailabilityPanel"
import {
  fetchBranchProviderAvailability,
  ensureProviderAvailabilityDefaults,
  type ProviderAvailabilityRow,
} from "@/lib/appointments/provider-availability-service"
import { usePermission } from "@/hooks/use-permission"

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Administrator",
  dentist: "Dentist",
  assistant: "Assistant",
  receptionist: "Receptionist",
}

export default function StaffSettingsPage() {
  const { availableBranches } = useBranch()
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [invitations, setInvitations] = useState<StaffInvitation[]>([])
  const [roles, setRoles] = useState<Awaited<ReturnType<typeof fetchRolesList>>>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const { hasPermission } = usePermission()
  const canWriteAppts = hasPermission(PERMISSIONS.APPOINTMENTS_WRITE)
  const [activeBranchId, setActiveBranchId] = useState<string>("")
  const [availabilityRows, setAvailabilityRows] = useState<ProviderAvailabilityRow[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const [staffResult, inviteResult, roleList] = await Promise.all([
      fetchOrgStaff(),
      fetchPendingInvitations(),
      fetchRolesList(),
    ])
    setStaff(staffResult.data)
    setInvitations(inviteResult.data)
    setRoles(roleList)
    setError(staffResult.error ?? inviteResult.error)
    
    if (availableBranches.length > 0) {
      const initialBranch = availableBranches[0]
      setActiveBranchId(initialBranch.id)
    }

    setLoading(false)
  }

  const reloadAvailability = async (branchId: string) => {
    if (!branchId) return
    setAvailabilityLoading(true)
    const { data: rows } = await fetchBranchProviderAvailability(branchId)
    setAvailabilityRows(rows)
    setAvailabilityLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (activeBranchId) {
      reloadAvailability(activeBranchId)
    }
  }, [activeBranchId])

  const handleRevokeInvite = async (inv: StaffInvitation) => {
    if (!confirm(`Revoke invitation for ${inv.email}?`)) return
    setActionId(inv.id)
    const { error: revokeError } = await revokeStaffInvitation(inv.id)
    if (revokeError) {
      setError(revokeError)
    } else {
      const org = await fetchOrganization()
      if (org) {
        await logAuditEvent({
          organizationId: org.id,
          branchId: inv.branch_id,
          action: "staff.invite.revoke",
          entityType: "staff_invitation",
          entityId: inv.id,
          metadata: { email: inv.email },
        })
      }
      setSuccess(`Invitation for ${inv.email} revoked.`)
      await load()
    }
    setActionId(null)
  }

  const toggleActive = async (member: StaffMember) => {
    setActionId(member.profile_id)
    const fn = member.is_active ? deactivateStaff : reactivateStaff
    const { error: toggleError } = await fn(member.profile_id)
    if (toggleError) {
      setError(toggleError)
    } else {
      const org = await fetchOrganization()
      if (org) {
        await logAuditEvent({
          organizationId: org.id,
          action: member.is_active ? "staff.deactivate" : "staff.reactivate",
          entityType: "staff",
          entityId: member.profile_id,
          metadata: { action: member.is_active ? "deactivated" : "reactivated" },
        })
      }
      await load()
    }
    setActionId(null)
  }

  const branchName = (id: string) => availableBranches.find((b) => b.id === id)?.name ?? id.slice(0, 8)
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "staff"

  const activeCount = staff.filter((m) => m.is_active).length

  if (loading) {
    return <PageLoadingSkeleton variant="form" className="max-w-none px-0 py-0" />
  }

  return (
    <PermissionGate permission={PERMISSIONS.STAFF_MANAGE}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("settings.staffEyebrow", "Team") + " · " + t("settings.staffTitle", "Staff")}
        icon={Users}
        title={t("settings.staffTitle", "Staff & Team")}
        description={t("settings.staffSubtitle", "Manage clinic staff, roles, and branch assignments.")}
        actions={
          <Button asChild className="gap-2 shadow-sm">
            <Link href="/settings/staff/invite">
              <UserPlus className="h-4 w-4" />
              {t("settings.inviteStaff", "Invite Staff Member")}
            </Link>
          </Button>
        }
        metrics={[
          {
            label: t("settings.metricStaff", "Team members"),
            value: staff.length,
            hint: t("settings.metricStaffHint", "All profiles"),
            icon: Users,
          },
          {
            label: t("settings.metricActive", "Active"),
            value: activeCount,
            hint: t("settings.metricActiveHint", "Can sign in"),
            variant: "success",
          },
          {
            label: t("settings.metricInvites", "Pending invites"),
            value: invitations.length,
            hint: t("settings.metricInvitesHint", "Awaiting acceptance"),
            variant: invitations.length > 0 ? "warning" : "default",
            icon: UserPlus,
          },
        ]}
        metricsClassName="lg:grid-cols-3"
        error={error}
        onRetry={() => void load()}
        retryLabel={t("common.retry", "Retry")}
        panel={false}
      >
        {success && (
          <p className="text-sm text-success-800 bg-success-50 border border-success-200 rounded-xl px-4 py-2 animate-fade-rise">
            {success}
          </p>
        )}

        {invitations.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3">Pending invitations</h3>
              <ul className="text-sm divide-y">
                {invitations.map((inv) => (
                  <li key={inv.id} className="py-2 flex items-center justify-between gap-4">
                    <span>
                      <span className="font-medium">{inv.email}</span>
                      {inv.full_name && <span className="text-neutral-500"> — {inv.full_name}</span>}
                      <span className="block text-neutral-500 text-xs mt-0.5">
                        {branchName(inv.branch_id)} · {roleName(inv.role_id)}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 shrink-0"
                      disabled={actionId === inv.id}
                      onClick={() => handleRevokeInvite(inv)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {staff.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-neutral-500">
              No staff members found. Sign in as the clinic owner to bootstrap your organization.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Branches</th>
                      <th className="px-6 py-3 font-medium">SMS phone</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {staff.map((member) => (
                      <tr key={member.profile_id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-neutral-900">
                              {member.full_name ?? "Unnamed"}
                            </span>
                            <span className="text-neutral-500">{member.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="info">
                            {ROLE_LABELS[member.role_name] ?? member.role_name}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-neutral-600">
                          {member.branch_names.filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-6 py-4">
                          {member.is_owner_or_admin ? (
                            member.phone_number ? (
                              <span className="text-neutral-700">{member.phone_number}</span>
                            ) : (
                              <Badge variant="warning">Missing — digest SMS</Badge>
                            )
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={member.is_active ? "success" : "outline"}>
                            {member.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right space-x-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/settings/staff/${member.profile_id}`}>Edit</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionId === member.profile_id}
                            onClick={() => toggleActive(member)}
                          >
                            {member.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {availableBranches.length > 1 && (
          <div className="flex items-center gap-2 mt-6 bg-white p-4 rounded-xl border border-neutral-200">
            <span className="text-sm font-medium text-neutral-700">Select Branch for Availability Settings:</span>
            <select
              value={activeBranchId}
              onChange={(e) => {
                setActiveBranchId(e.target.value)
                reloadAvailability(e.target.value)
              }}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm"
            >
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-6">
          <ProviderAvailabilityPanel
            rows={availabilityRows}
            loading={availabilityLoading}
            branchId={activeBranchId}
            providers={staff
              .filter((s) => s.is_active && s.role_name === "dentist")
              .map((p) => ({
                profile_id: p.profile_id,
                name: p.full_name || p.email || "Dentist",
              }))}
            canWrite={canWriteAppts}
            onSaved={() => reloadAvailability(activeBranchId)}
            defaultCollapsed={false}
          />
        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
