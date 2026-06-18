"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Trash2, UserCog } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PermissionDenied } from "@/components/auth/PermissionDenied"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useAuth } from "@/hooks/use-auth"
import { usePermission } from "@/hooks/use-permission"
import { fetchAllOrgBranches } from "@/lib/org/branch-service"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { toast } from "sonner"
import {
  fetchRolesList,
  getStaffMember,
  removeStaffAssignment,
  updateStaffProfile,
  upsertStaffAssignment,
} from "@/lib/staff/staff-service"
import { Input } from "@/components/ui/input"

export default function StaffDetailPage() {
  const params = useParams()
  const profileId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const { hasPermission, loading: permLoading } = usePermission()
  const canManageStaff = hasPermission(PERMISSIONS.STAFF_MANAGE)
  const isSelf = user?.id === profileId
  const [member, setMember] = useState<Awaited<ReturnType<typeof getStaffMember>>["data"]>(null)
  const [branches, setBranches] = useState<Awaited<ReturnType<typeof fetchAllOrgBranches>>>([])
  const [roles, setRoles] = useState<Awaited<ReturnType<typeof fetchRolesList>>>([])
  const [branchId, setBranchId] = useState("")
  const [roleId, setRoleId] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [specialization, setSpecialization] = useState("")
  const [prcLicenseNumber, setPrcLicenseNumber] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [staffResult, branchList, roleList] = await Promise.all([
      getStaffMember(profileId),
      fetchAllOrgBranches(),
      fetchRolesList(),
    ])
    setMember(staffResult.data)
    setError(staffResult.error)
    setPhoneNumber(staffResult.data?.phone_number ?? "")
    setSpecialization(staffResult.data?.specialization ?? "")
    setPrcLicenseNumber(staffResult.data?.prc_license_number ?? "")
    setBranches(branchList)
    setRoles(roleList)
    if (roleList.length > 0 && !roleId) setRoleId(roleList[0].id)
    if (branchList.length > 0 && !branchId) setBranchId(branchList[0].id)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    setError(null)
    const { error: err } = await updateStaffProfile({
      profileId,
      phoneNumber,
      specialization,
      prcLicenseNumber,
    })
    if (err) {
      toast.error(err)
      setError(err)
    } else {
      toast.success("Profile updated successfully")
      await load()
    }
    setProfileSaving(false)
  }

  const handleAdd = async () => {
    if (!branchId || !roleId) return
    setSaving(true)
    const { error: err } = await upsertStaffAssignment(profileId, branchId, roleId)
    if (err) {
      toast.error(err)
      setError(err)
    } else {
      const org = await fetchOrganization()
      if (org) {
        await logAuditEvent({
          organizationId: org.id,
          branchId,
          action: "staff.assign",
          entityType: "staff_assignment",
          entityId: profileId,
          metadata: { branch_id: branchId, role_id: roleId, op: "assign" },
        })
      }
      toast.success("Branch assignment added")
      await load()
    }
    setSaving(false)
  }

  const handleRemove = async (bId: string) => {
    setSaving(true)
    const { error: err } = await removeStaffAssignment(profileId, bId)
    if (err) {
      toast.error(err)
      setError(err)
    } else {
      const org = await fetchOrganization()
      if (org) {
        await logAuditEvent({
          organizationId: org.id,
          branchId: bId,
          action: "staff.unassign",
          entityType: "staff_assignment",
          entityId: profileId,
          metadata: { branch_id: bId, op: "remove" },
        })
      }
      toast.success("Branch assignment removed")
      await load()
    }
    setSaving(false)
  }

  if (authLoading || permLoading) {
    return <PageLoadingSkeleton variant="form" className="max-w-none px-0 py-0" />
  }

  if (!canManageStaff && !isSelf) {
    return <PermissionDenied permission={PERMISSIONS.STAFF_MANAGE} />
  }

  if (loading) {
    return <PageLoadingSkeleton variant="form" className="max-w-none px-0 py-0" />
  }

  if (!member) {
    return (
      <div className="text-center py-12">
        <p className="text-red-800">{error ?? "Staff not found"}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href={isSelf ? "/settings/organization" : "/settings/staff"}>Back</Link>
        </Button>
      </div>
    )
  }

  return (
      <ModulePageShell
        icon={UserCog}
        eyebrow={isSelf && !canManageStaff ? "Account" : "Settings · Staff"}
        title={member.full_name ?? member.email}
        description={member.email}
        maxWidth=""
        className="w-full"
        panel={false}
        error={error}
        onRetry={load}
        badges={
          <Badge variant={member.is_active ? "success" : "outline"}>
            {member.is_active ? "Active" : "Inactive"}
          </Badge>
        }
        actions={
          canManageStaff ? (
            <Button variant="ghost" size="icon" asChild>
              <Link href="/settings/staff" aria-label="Back to staff">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : null
        }
      >
        <ContentPanel>
        <Card className="border-0 shadow-none mb-4">
          <CardHeader>
            <CardTitle className="text-base">Contact & profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {member.is_owner_or_admin && !phoneNumber.trim() ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Owner/admin phone is required for daily digest SMS when{" "}
                <strong>Owner daily digest SMS</strong> is enabled under Workflow automation.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="staff-phone" className="text-xs font-medium text-neutral-600">
                  Mobile (SMS)
                </label>
                <Input
                  id="staff-phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+639171234567"
                  autoComplete="tel"
                />
                <p className="text-[11px] text-neutral-500">Philippines format, e.g. +63917…</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="staff-spec" className="text-xs font-medium text-neutral-600">
                  Specialization
                </label>
                <Input
                  id="staff-spec"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="General dentistry"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="staff-prc" className="text-xs font-medium text-neutral-600">
                  PRC license number
                </label>
                <Input
                  id="staff-prc"
                  value={prcLicenseNumber}
                  onChange={(e) => setPrcLicenseNumber(e.target.value)}
                  placeholder="e.g. PRC 1234567"
                  autoComplete="off"
                />
                <p className="text-[11px] text-neutral-500">
                  Used on doctor-signed prescriptions, medical certificates, abstracts, and discharge outputs.
                </p>
              </div>
            </div>
            <Button onClick={() => void handleSaveProfile()} disabled={profileSaving}>
              {profileSaving ? "Saving…" : "Save contact info"}
            </Button>
          </CardContent>
        </Card>

        {canManageStaff ? (
        <Card className="border-0 shadow-none">
          <CardHeader><CardTitle className="text-base">Branch Assignments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {member.assignments.length === 0 ? (
              <p className="text-sm text-neutral-500">No branch assignments yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {member.assignments.map((a) => (
                  <li key={a.branch_id} className="py-3 flex items-center justify-between">
                    <span>
                      <span className="font-medium">{a.branch_name}</span>
                      <Badge variant="outline" className="ml-2">{a.role_name}</Badge>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => handleRemove(a.branch_id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-3 pt-4 border-t">
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <Button onClick={handleAdd} disabled={saving || !branchId || !roleId}>
                {saving ? "Saving…" : "Add Assignment"}
              </Button>
            </div>
          </CardContent>
        </Card>
        ) : (
          member.assignments.length > 0 ? (
            <Card className="border-0 shadow-none">
              <CardHeader><CardTitle className="text-base">Your branches</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {member.assignments.map((a) => (
                    <li key={a.branch_id} className="py-3">
                      <span className="font-medium">{a.branch_name}</span>
                      <Badge variant="outline" className="ml-2">{a.role_name}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null
        )}
        </ContentPanel>
      </ModulePageShell>
  )
}
