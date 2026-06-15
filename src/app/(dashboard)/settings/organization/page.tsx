"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { fetchOrganization, updateOrganization } from "@/lib/auth/auth-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { usePermission } from "@/hooks/use-permission"
import { fetchAllOrgBranches } from "@/lib/org/branch-service"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchEffectiveSettings } from "@/lib/settings/settings-service"
import {
  fetchOrganizationPreferences,
  updateOrganizationPreferences,
} from "@/lib/settings/org-preferences-service"
import { saveBranchRegionalOverrides } from "@/lib/org/branch-context-service"
import Link from "next/link"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Building, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function OrganizationSettingsPage() {
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const { hasPermission } = usePermission()
  const canManage = hasPermission(PERMISSIONS.SETTINGS_MANAGE)
  const [loading, setLoading] = useState(true)
  const [branchCount, setBranchCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [address, setAddress] = useState("")
  const [timezone, setTimezone] = useState("Asia/Manila")
  const [currencyCode, setCurrencyCode] = useState("PHP")
  const [slug, setSlug] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("active")
  const [planTier, setPlanTier] = useState<string>("standard")
  const [branchPricingEnabled, setBranchPricingEnabled] = useState(false)
  const [customProcedureShowPrice, setCustomProcedureShowPrice] = useState(false)

  useEffect(() => {
    Promise.all([fetchOrganization(), fetchAllOrgBranches()]).then(([org, branches]) => {
      if (org) {
        setOrgId(org.id)
        setName(org.name)
        setContactNumber(org.contact_number ?? "")
        setAddress(org.address ?? "")
        setTimezone(org.timezone ?? "Asia/Manila")
        setSlug(org.slug ?? null)
        setStatus(org.status ?? "active")
        setPlanTier(org.plan_tier ?? "standard")
      }
      setBranchCount(branches.length)
      setLoading(false)
    })
    void fetchOrganizationPreferences().then(({ data }) => {
      if (!data) return
      setBranchPricingEnabled(data.branch_procedure_pricing_enabled)
      setCustomProcedureShowPrice(data.custom_procedure_show_price)
    })
  }, [])

  useEffect(() => {
    if (!activeBranch) return
    fetchEffectiveSettings(activeBranch.id).then(({ data }) => {
      if (!data) return
      setTimezone(data.timezone)
      setCurrencyCode(data.currency_code)
    })
  }, [activeBranch])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: saveError } = await updateOrganization(orgId, {
      name,
      address: address || null,
      contact_number: contactNumber || null,
    })

    if (saveError) {
      setSaving(false)
      setError(saveError)
      return
    }

    if (activeBranch && canManage) {
      const { error: regionalError } = await saveBranchRegionalOverrides(activeBranch.id, {
        timezone,
        currencyCode,
      })
      if (regionalError) {
        setSaving(false)
        setError(regionalError)
        return
      }
      const { error: prefError } = await updateOrganizationPreferences({
        branch_procedure_pricing_enabled: branchPricingEnabled,
        custom_procedure_show_price: customProcedureShowPrice,
      })
      if (prefError) {
        setSaving(false)
        setError(prefError)
        return
      }
    }

    setSaving(false)
    await logAuditEvent({
      organizationId: orgId,
      action: "organization.update",
      entityType: "organization",
      entityId: orgId,
    })
    setSaved(true)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="form" className="max-w-none px-0 py-0" />
  }

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("settings.orgEyebrow", "Clinic") + " · " + t("settings.organizationTitle", "Organization")}
        icon={Building}
        title={t("settings.organizationTitle", "Organization Profile")}
        description={
          canManage
            ? t("settings.organizationSubtitle", "Update your clinic's primary information.")
            : t("settings.organizationSubtitleReadonly", "Read-only organization details for your clinic.")
        }
        actions={
          canManage ? (
            <Button className="shadow-sm" onClick={handleSave} disabled={saving || !orgId}>
              {saving ? t("settings.saving", "Saving…") : t("settings.saveChanges", "Save Changes")}
            </Button>
          ) : undefined
        }
        badges={
          <div className="flex flex-wrap items-center gap-2 animate-fade-rise">
            {activeBranch ? (
              <Badge variant="info" className="gap-1 font-normal">
                <MapPin className="h-3 w-3" aria-hidden />
                {activeBranch.name}
              </Badge>
            ) : null}
            {slug ? (
              <Badge variant="outline" className="font-mono text-xs font-normal">
                {slug}
              </Badge>
            ) : null}
          </div>
        }
        metrics={[
          {
            label: t("settings.metricBranches", "Branches"),
            value: branchCount,
            hint: t("settings.metricBranchesHint", "Clinic locations"),
            icon: Building,
          },
          {
            label: t("settings.metricPlan", "Plan"),
            value: planTier,
            hint: status,
            variant: "default",
          },
        ]}
        metricsClassName="lg:grid-cols-2"
        error={error}
        panel={false}
      >
        {saved && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2 animate-fade-rise">
            Organization profile saved.
          </p>
        )}

        <Card className="border-primary-100 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="text-base">Multi-branch tenant</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-700 space-y-2">
            <p>
              This account is an isolated <strong>organization</strong> (one rented clinic brand).
              Patients belong to the whole organization; appointments, billing, and queue are scoped
              to the active <strong>branch</strong> you select in the top bar.
            </p>
            <p className="text-neutral-500">
              To onboard another clinic, create a separate signup — each gets its own organization and data wall.
            </p>
            {slug ? (
              <p className="text-xs text-neutral-500 pt-1">
                Tenant ID: <code className="rounded bg-white px-1.5 py-0.5">{slug}</code>
                {status ? ` · ${status}` : ""}
                {planTier ? ` · ${planTier}` : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Billing &amp; procedure preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={branchPricingEnabled}
                  onChange={(e) => setBranchPricingEnabled(e.target.checked)}
                />
                <span>
                  <strong>Per-branch procedure pricing</strong>
                  <span className="block text-neutral-500 text-xs mt-0.5">
                    For multi-location clinics only. Single-branch clinics keep one org-wide price list.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={customProcedureShowPrice}
                  onChange={(e) => setCustomProcedureShowPrice(e.target.checked)}
                />
                <span>
                  <strong>Show price field for custom / free-text procedures</strong>
                  <span className="block text-neutral-500 text-xs mt-0.5">
                    When off, custom plan items have no price until invoicing.
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">General Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Organization Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Contact Number</label>
              <Input
                placeholder="+63 900 000 0000"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                disabled={!canManage}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Primary Address</label>
              <Input
                placeholder="Manila, Philippines"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!canManage}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!canManage || !activeBranch}
                className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="Asia/Manila">Asia/Manila (PH)</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="UTC">UTC</option>
              </select>
              <p className="text-xs text-neutral-500">
                Applies to {activeBranch?.name ?? "the active branch"} when you save.
                {activeBranch ? (
                  <>
                    {" "}
                    <Link
                      href={`/settings/branches/${activeBranch.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      Branch settings
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Currency</label>
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                disabled={!canManage || !activeBranch}
                className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="PHP">PHP — Philippine Peso</option>
                <option value="USD">USD — US Dollar</option>
              </select>
              <p className="text-xs text-neutral-500">
                Billing currency for invoices and receipts on the active branch.
              </p>
            </div>
            <div className="grid gap-2 pt-2 border-t border-neutral-100">
              <label className="text-sm font-medium text-neutral-500">Active branches</label>
              <p className="text-sm text-neutral-900">{branchCount}</p>
            </div>
          </CardContent>
        </Card>
      </ModulePageShell>
    </PermissionGate>
  )
}
