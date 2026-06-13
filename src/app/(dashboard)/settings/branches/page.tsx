"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchOrgBranchesForSettings, createBranch } from "@/lib/org/branch-service"
import { fetchMyBranches, fetchOrganization } from "@/lib/auth/auth-service"
import { useBranch } from "@/hooks/use-branch"
import { logAuditEvent } from "@/lib/audit/audit-service"
import type { BranchRecord } from "@/lib/auth/permissions"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Building2, MapPin } from "lucide-react"

export default function BranchesSettingsPage() {
  const { t } = useLocale()
  const { setAvailableBranches, bumpBranchRevision } = useBranch()
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [org, list] = await Promise.all([fetchOrganization(), fetchOrgBranchesForSettings()])
    setOrgId(org?.id ?? null)
    setBranches(list)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async () => {
    if (!orgId || !newName.trim()) return
    setCreating(true)
    setError(null)

    const { data, error: createError } = await createBranch({
      name: newName.trim(),
      address: newAddress.trim() || undefined,
      organization_id: orgId,
    })

    setCreating(false)
    if (createError) {
      setError(createError)
      return
    }

    if (data) {
      setBranches((prev) => [...prev, data])
      const refreshed = await fetchMyBranches()
      setAvailableBranches(
        refreshed.map((b) => ({
          id: b.id,
          name: b.name,
          organization_id: b.organization_id,
        }))
      )
      bumpBranchRevision()
      await logAuditEvent({
        organizationId: orgId,
        branchId: data.id,
        action: "branch.create",
        entityType: "branch",
        entityId: data.id,
      })
    }
    setNewName("")
    setNewAddress("")
    setShowForm(false)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="form" className="max-w-none px-0 py-0" />
  }

  const activeBranches = branches.filter((b) => b.is_active).length

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("settings.branchesEyebrow", "Locations") + " · " + t("settings.branchesTitle", "Branches")}
        icon={Building2}
        title={t("settings.branchesTitle", "Branches")}
        description={t(
          "settings.branchesSubtitle",
          "Each organization is one rented clinic. Branches are locations sharing the same patient registry."
        )}
        actions={
          <Button className="shadow-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? t("common.cancel", "Cancel") : t("settings.addBranch", "Add Branch")}
          </Button>
        }
        metrics={[
          {
            label: t("settings.metricBranches", "Branches"),
            value: branches.length,
            hint: t("settings.metricBranchesHint", "Clinic locations"),
            icon: Building2,
          },
          {
            label: t("settings.metricActive", "Active"),
            value: activeBranches,
            hint: t("settings.metricBranchesActiveHint", "Open for operations"),
            variant: "success",
          },
        ]}
        metricsClassName="lg:grid-cols-2"
        error={error}
        panel={false}
      >
        {showForm && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Branch Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Makati Main Clinic"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Address</label>
                <Input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Ayala Avenue, Makati City"
                />
              </div>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? "Creating…" : "Create Branch"}
              </Button>
            </CardContent>
          </Card>
        )}

        {branches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-neutral-600 mb-4">No branches yet.</p>
              <Button onClick={() => setShowForm(true)}>Create your first branch</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {branches.map((branch) => (
              <Card key={branch.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary-600 shrink-0" aria-hidden />
                      <span className="font-semibold text-neutral-900">{branch.name}</span>
                      <Badge variant={branch.is_active ? "success" : "outline"}>
                        {branch.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <span className="text-sm text-neutral-500">
                      {branch.address ?? "No address set"}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/settings/branches/${branch.id}`}>Manage Settings</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ModulePageShell>
    </PermissionGate>
  )
}
