"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, UserPlus } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchRolesList, inviteStaffMember } from "@/lib/staff/staff-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { useBranch } from "@/hooks/use-branch"

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Administrator",
  dentist: "Dentist",
  assistant: "Assistant",
  receptionist: "Receptionist",
}

export default function StaffInvitePage() {
  const router = useRouter()
  const { availableBranches, activeBranch } = useBranch()
  const [roles, setRoles] = useState<Awaited<ReturnType<typeof fetchRolesList>>>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteBranchId, setInviteBranchId] = useState("")
  const [inviteRoleId, setInviteRoleId] = useState("")

  useEffect(() => {
    if (activeBranch && !inviteBranchId) setInviteBranchId(activeBranch.id)
  }, [activeBranch, inviteBranchId])

  useEffect(() => {
    fetchRolesList().then((roleList) => {
      setRoles(roleList)
      const inviteable = roleList.filter((r) => r.name !== "owner")
      if (inviteable.length > 0) {
        setInviteRoleId(inviteable.find((r) => r.name === "receptionist")?.id ?? inviteable[0].id)
      }
      setLoading(false)
    })
  }, [])

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteBranchId || !inviteRoleId) return
    setInviting(true)
    setError(null)

    const { error: inviteError, invitationId } = await inviteStaffMember({
      email: inviteEmail.trim(),
      fullName: inviteName.trim(),
      branchId: inviteBranchId,
      roleId: inviteRoleId,
    })

    if (inviteError) {
      setError(inviteError)
      setInviting(false)
      return
    }

    const org = await fetchOrganization()
    if (org) {
      await logAuditEvent({
        organizationId: org.id,
        branchId: inviteBranchId,
        action: "staff.invite",
        entityType: "staff_invitation",
        entityId: invitationId ?? inviteEmail,
        metadata: { email: inviteEmail.trim() },
      })
    }

    router.push("/settings/staff")
  }

  if (loading) {
    return <PageLoadingSkeleton variant="form" className="max-w-none px-0 py-0" />
  }

  return (
    <PermissionGate permission={PERMISSIONS.STAFF_MANAGE}>
      <ModulePageShell
        icon={UserPlus}
        eyebrow="Settings · Staff"
        title="Invite staff member"
        description="Send an email invitation via the invite-staff Edge Function."
        maxWidth=""
        className="w-full max-w-2xl"
        panel={false}
        error={error}
        actions={
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings/staff" aria-label="Back to staff">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <ContentPanel>
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Invitation details</CardTitle>
            <CardDescription>
              The invitee will receive a link to join your organization with the selected role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">Email</label>
                <Input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@clinic.com"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">Full name</label>
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Maria Santos"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Branch</label>
                <select
                  value={inviteBranchId}
                  onChange={(e) => setInviteBranchId(e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm"
                >
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Role</label>
                <select
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm"
                >
                  {roles.filter((r) => r.name !== "owner").map((r) => (
                    <option key={r.id} value={r.id}>
                      {ROLE_LABELS[r.name] ?? r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <Button type="submit" disabled={inviting}>
                  {inviting ? "Sending…" : "Send Invite Email"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/settings/staff">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </ContentPanel>
      </ModulePageShell>
    </PermissionGate>
  )
}
