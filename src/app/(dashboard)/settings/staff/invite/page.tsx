import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, UserPlus, Mail, UserCheck } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchRolesList, inviteStaffMember, addStaffMemberDirectly } from "@/lib/staff/staff-service"
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
  
  // Modes: "invite" or "direct"
  const [addMode, setAddMode] = useState<"invite" | "direct">("direct")
  
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteBranchId, setInviteBranchId] = useState("")
  const [inviteRoleId, setInviteRoleId] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [specialization, setSpecialization] = useState("")

  useEffect(() => {
    if (activeBranch && !inviteBranchId) setInviteBranchId(activeBranch.id)
  }, [activeBranch, inviteBranchId])

  useEffect(() => {
    fetchRolesList().then((roleList) => {
      setRoles(roleList)
      const inviteable = roleList.filter((r) => r.name !== "owner")
      if (inviteable.length > 0) {
        setInviteRoleId(inviteable.find((r) => r.name === "dentist")?.id ?? inviteable[0].id)
      }
      setLoading(false)
    })
  }, [])

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteBranchId || !inviteRoleId) return
    setInviting(true)
    setError(null)

    if (addMode === "direct") {
      const { error: directError, profileId } = await addStaffMemberDirectly({
        email: inviteEmail.trim(),
        fullName: inviteName.trim(),
        branchId: inviteBranchId,
        roleId: inviteRoleId,
        phoneNumber: phoneNumber.trim() || undefined,
        specialization: specialization.trim() || undefined
      })

      if (directError) {
        setError(directError)
        setInviting(false)
        return
      }

      const org = await fetchOrganization()
      if (org) {
        await logAuditEvent({
          organizationId: org.id,
          branchId: inviteBranchId,
          action: "staff.invite",
          entityType: "staff",
          entityId: profileId ?? inviteEmail,
          metadata: { email: inviteEmail.trim(), mode: "direct" },
        })
      }
    } else {
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
        title={addMode === "direct" ? "Add Staff Member Directly" : "Invite Staff Member"}
        description={addMode === "direct" ? "Directly register a provider or doctor to the branch database." : "Send an email invitation link to join your organization."}
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
          {/* Add Mode Selector Tab Group */}
          <div className="flex gap-2 mb-4 p-1 bg-neutral-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setAddMode("direct")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all ${addMode === "direct" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Add Directly (Fast Setup)
            </button>
            <button
              type="button"
              onClick={() => setAddMode("invite")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all ${addMode === "invite" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
            >
              <Mail className="h-3.5 w-3.5" />
              Send Invite Email
            </button>
          </div>

          <Card className="border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base">
                {addMode === "direct" ? "Staff Information" : "Invitation Details"}
              </CardTitle>
              <CardDescription>
                {addMode === "direct" 
                  ? "Bypass invitation emails and add the profile directly to testing/production branch."
                  : "The invitee will receive a link to join your organization with the selected role."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
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
                  <label className="text-xs font-medium">Full Name</label>
                  <Input
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Dr. Maria Santos"
                  />
                </div>
                
                {addMode === "direct" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Phone Number</label>
                      <Input
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+63 912 345 6789"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Specialization (e.g., Ortho, Pedo)</label>
                      <Input
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        placeholder="General Dentistry"
                      />
                    </div>
                  </>
                )}

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
                    {inviting 
                      ? (addMode === "direct" ? "Creating…" : "Sending…")
                      : (addMode === "direct" ? "Add Staff Member" : "Send Invite Email")}
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
