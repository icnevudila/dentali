"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, MapPin } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { deactivateBranch, updateBranch } from "@/lib/org/branch-service"
import {
  fetchBranchContext,
  saveBranchRegionalOverrides,
} from "@/lib/org/branch-context-service"
import {
  DAY_LABELS,
  fetchClinicHours,
  updateClinicHour,
  type ClinicHourRow,
} from "@/lib/org/clinic-hours-service"
import { fetchMyBranches, fetchOrganization } from "@/lib/auth/auth-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { notify } from "@/lib/ui/notify"
import { createClient } from "@/lib/supabase/client"

export default function BranchDetailPage() {
  const params = useParams()
  const branchId = params.id as string
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [hours, setHours] = useState<ClinicHourRow[]>([])
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [timezone, setTimezone] = useState("Asia/Manila")
  const [currencyCode, setCurrencyCode] = useState("PHP")
  const [orgTimezone, setOrgTimezone] = useState("Asia/Manila")
  const [orgCurrency, setOrgCurrency] = useState("PHP")
  const [deactivateReason, setDeactivateReason] = useState("")
  const { activeBranch, setActiveBranch, setAvailableBranches, bumpBranchRevision } = useBranch()
  const { t } = useLocale()

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from("branches")
        .select("name, address, contact_number, is_active")
        .eq("id", branchId)
        .maybeSingle(),
      fetchClinicHours(branchId),
      fetchBranchContext(branchId),
    ]).then(([branchResult, hoursResult, contextResult]) => {
      const { data, error: fetchError } = branchResult
      if (fetchError || !data) {
        setError(fetchError?.message ?? "Branch not found")
      } else {
        setName(data.name)
        setAddress(data.address ?? "")
        setContactNumber(data.contact_number ?? "")
        setIsActive(data.is_active ?? true)
      }
      setHours(hoursResult.data)
      if (hoursResult.error) setError(hoursResult.error)
      if (contextResult.data) {
        setTimezone(contextResult.data.timezone)
        setCurrencyCode(contextResult.data.currency_code)
        const overrides = contextResult.data.branch_overrides
        if (!overrides.timezone) setOrgTimezone(contextResult.data.timezone)
        else setOrgTimezone(contextResult.data.timezone)
        if (!overrides.currency_code) setOrgCurrency(contextResult.data.currency_code)
        else setOrgCurrency(contextResult.data.currency_code)
      }
      if (contextResult.error) setError(contextResult.error)
      setLoading(false)
    })
  }, [branchId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: saveError } = await updateBranch(branchId, {
      name,
      address: address || null,
      contact_number: contactNumber || null,
    })

    for (const row of hours) {
      await updateClinicHour(row.id, {
        open_time: row.open_time,
        close_time: row.close_time,
        is_closed: row.is_closed,
      })
    }

    await saveBranchRegionalOverrides(branchId, {
      timezone,
      currencyCode,
    })

    const org = await fetchOrganization()
    if (org && !saveError) {
      await logAuditEvent({
        organizationId: org.id,
        branchId,
        action: "branch.update",
        entityType: "branch",
        entityId: branchId,
      })
    }

    setSaving(false)
    if (saveError) setError(saveError)
    else setSaved(true)
  }

  const handleDeactivate = async () => {
    if (!deactivateReason.trim() || deactivateReason.trim().length < 3) {
      setError(t("settings.deactivateReasonRequired", "Please enter a reason (at least 3 characters)."))
      return
    }
    if (
      !(await notify.confirm(
        t(
          "settings.deactivateConfirm",
          "Deactivate this branch? Staff will lose branch access and kiosk/display links will be revoked."
        )
      ))
    ) {
      return
    }
    setDeactivating(true)
    setError(null)
    const { error: deactError } = await deactivateBranch(branchId, deactivateReason.trim())
    setDeactivating(false)
    if (deactError) {
      setError(deactError)
      return
    }
    setIsActive(false)
    setDeactivateReason("")
    const branches = await fetchMyBranches()
    setAvailableBranches(
      branches.map((b) => ({
        id: b.id,
        name: b.name,
        organization_id: b.organization_id,
      }))
    )
    if (activeBranch?.id === branchId) {
      const next = branches[0]
      if (next) {
        setActiveBranch({
          id: next.id,
          name: next.name,
          organization_id: next.organization_id,
        })
      }
    }
    bumpBranchRevision()
  }

  const updateHour = (id: string, patch: Partial<ClinicHourRow>) => {
    setHours((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)))
  }

  const copyMondayToWeekdays = () => {
    const monday = hours.find((h) => h.day_of_week === 1)
    if (!monday) return
    setHours((prev) =>
      prev.map((h) =>
        h.day_of_week >= 2 && h.day_of_week <= 5
          ? {
              ...h,
              open_time: monday.open_time,
              close_time: monday.close_time,
              is_closed: monday.is_closed,
            }
          : h
      )
    )
  }

  const openDaysCount = hours.filter((h) => !h.is_closed).length
  const formatHour = (t: string | null) => (t ? t.slice(0, 5) : "—")

  if (loading) {
    return <PageLoadingSkeleton variant="form" className="max-w-none px-0 py-0" />
  }

  if (error && !name) {
    return (
      <div className="text-center py-12">
        <p className="text-red-800">{error}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/settings/branches">Back to branches</Link>
        </Button>
      </div>
    )
  }

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        icon={MapPin}
        eyebrow="Settings · Branches"
        title={name || t("settings.branchSettings", "Branch settings")}
        description={t("settings.branchSettingsHint", "Configure this clinic location.")}
        maxWidth=""
        className="w-full"
        panel={false}
        error={error}
        badges={
          <Badge variant={isActive ? "success" : "outline"}>
            {isActive ? t("settings.active", "Active") : t("settings.inactive", "Inactive")}
          </Badge>
        }
        actions={
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings/branches" aria-label="Back to branches">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
        metrics={[
          {
            label: t("settings.openDays", "Open days"),
            value: String(openDaysCount),
            hint: t("settings.perWeek", "Per week"),
          },
          {
            label: t("settings.timezone", "Timezone"),
            value: timezone,
            hint: orgTimezone !== timezone ? `${t("settings.orgDefault", "Org")}: ${orgTimezone}` : "",
          },
        ]}
      >
        <div className="space-y-6">
        {saved && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-2">
            Branch settings saved.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branch Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Branch Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Contact Number</label>
              <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regional Overrides</CardTitle>
            <p className="text-sm text-neutral-500 mt-1">
              Branch-level timezone and currency. Leave as org defaults or customize per location.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Timezone</label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder={orgTimezone}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Currency code</label>
              <Input
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                placeholder={orgCurrency}
                maxLength={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Clinic Hours</CardTitle>
              <p className="text-sm text-neutral-500 mt-1">
                {openDaysCount} day{openDaysCount === 1 ? "" : "s"} open per week
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={copyMondayToWeekdays}>
              Copy Mon → Tue–Fri
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-3 text-xs font-medium text-neutral-500 px-1">
              <span>Day</span>
              <span>Closed</span>
              <span>Opens</span>
              <span>Closes</span>
            </div>
            {hours.map((row) => (
              <div key={row.id} className="grid grid-cols-4 gap-3 items-center text-sm border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0">
                <span className="font-medium">{DAY_LABELS[row.day_of_week]}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.is_closed}
                    onChange={(e) => updateHour(row.id, { is_closed: e.target.checked })}
                  />
                  <span className="text-xs text-neutral-500 sr-only sm:not-sr-only">
                    {row.is_closed ? "Closed" : "Open"}
                  </span>
                </label>
                <Input
                  type="time"
                  value={row.open_time?.slice(0, 5) ?? ""}
                  disabled={row.is_closed}
                  onChange={(e) => updateHour(row.id, { open_time: e.target.value || null })}
                />
                <Input
                  type="time"
                  value={row.close_time?.slice(0, 5) ?? ""}
                  disabled={row.is_closed}
                  onChange={(e) => updateHour(row.id, { close_time: e.target.value || null })}
                />
                {!row.is_closed && row.open_time && row.close_time && (
                  <p className="col-span-4 text-xs text-neutral-500 -mt-1">
                    {formatHour(row.open_time)} – {formatHour(row.close_time)}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || !isActive}>
            {saving ? t("settings.saving", "Saving…") : t("settings.saveChanges", "Save Changes")}
          </Button>
        </div>

        {isActive && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base text-red-800">
                {t("settings.deactivateBranch", "Deactivate Branch")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-neutral-600">
                {t(
                  "settings.deactivateHint",
                  "Staff lose access to this branch. Kiosk and TV display links are revoked. This action is logged to audit."
                )}
              </p>
              <Input
                placeholder={t("settings.deactivateReasonPlaceholder", "Reason for deactivation (required)")}
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
              />
              <Button
                variant="outline"
                className="text-red-700 border-red-300"
                onClick={handleDeactivate}
                disabled={deactivating || deactivateReason.trim().length < 3}
              >
                {deactivating
                  ? t("settings.deactivating", "Deactivating…")
                  : t("settings.deactivateBranch", "Deactivate Branch")}
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
