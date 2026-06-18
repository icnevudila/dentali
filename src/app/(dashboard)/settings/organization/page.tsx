"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
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
import {
  DEFAULT_PRESCRIPTION_BRANDING,
  type PrescriptionBrandingSettings,
} from "@/lib/branding/prescription-branding"
import { readBrandingImageFile } from "@/lib/branding/branding-image"
import { saveBranchRegionalOverrides } from "@/lib/org/branch-context-service"
import Link from "next/link"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Building, ImageIcon, MapPin, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type BrandingImageField = keyof Pick<
  PrescriptionBrandingSettings,
  "headerImageDataUrl" | "watermarkImageDataUrl" | "footerImageDataUrl" | "signatureImageDataUrl"
>

const BRANDING_IMAGE_FIELDS: Array<{
  key: BrandingImageField
  title: string
  hint: string
}> = [
  {
    key: "headerImageDataUrl",
    title: "Top banner image",
    hint: "Wide clinic header used at the top of the printed prescription.",
  },
  {
    key: "watermarkImageDataUrl",
    title: "Center watermark",
    hint: "Large faded logo behind the Rx body area.",
  },
  {
    key: "footerImageDataUrl",
    title: "Bottom strip image",
    hint: "Optional footer band or clinic strip above the bottom edge.",
  },
  {
    key: "signatureImageDataUrl",
    title: "Doctor signature image",
    hint: "Printed above the prescriber name block.",
  },
]

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
  const [prescriptionBranding, setPrescriptionBranding] = useState<PrescriptionBrandingSettings>(
    DEFAULT_PRESCRIPTION_BRANDING
  )

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
      setPrescriptionBranding(data.prescription_branding)
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
    }

    if (canManage) {
      const { error: prefError } = await updateOrganizationPreferences({
        branch_procedure_pricing_enabled: branchPricingEnabled,
        custom_procedure_show_price: customProcedureShowPrice,
        prescription_branding: prescriptionBranding,
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

  const updatePrescriptionBranding = <K extends keyof PrescriptionBrandingSettings>(
    key: K,
    value: PrescriptionBrandingSettings[K]
  ) => {
    setPrescriptionBranding((current) => ({ ...current, [key]: value }))
  }

  const handleBrandingImageSelect = async (key: BrandingImageField, file: File | null) => {
    if (!file) return
    setError(null)
    const { dataUrl, error: imageError } = await readBrandingImageFile(file)
    if (imageError || !dataUrl) {
      setError(imageError ?? "Could not process image")
      return
    }
    updatePrescriptionBranding(key, dataUrl)
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

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prescription print branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                {BRANDING_IMAGE_FIELDS.map((field) => {
                  const value = prescriptionBranding[field.key]
                  return (
                    <div key={field.key} className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{field.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{field.hint}</p>
                        </div>
                        <ImageIcon className="mt-0.5 h-4 w-4 text-neutral-400" aria-hidden />
                      </div>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-dashed border-neutral-300 bg-white">
                        {value ? (
                          <Image
                            src={value}
                            alt={field.title}
                            width={960}
                            height={360}
                            unoptimized
                            className="h-36 w-full object-contain bg-[linear-gradient(135deg,#f8fafc,#eefbf8)]"
                          />
                        ) : (
                          <div className="flex h-36 items-center justify-center px-4 text-center text-xs text-neutral-400">
                            Upload PNG or JPG. The image will be stored in your organization preferences.
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                          Choose image
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={(e) => void handleBrandingImageSelect(field.key, e.target.files?.[0] ?? null)}
                          />
                        </label>
                        {value ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => updatePrescriptionBranding(field.key, null)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Doctor subtitle</label>
                  <Input
                    value={prescriptionBranding.doctorTitle ?? ""}
                    onChange={(e) => updatePrescriptionBranding("doctorTitle", e.target.value || null)}
                    placeholder="General Dentistry"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Footer note</label>
                  <Input
                    value={prescriptionBranding.footerNote ?? ""}
                    onChange={(e) => updatePrescriptionBranding("footerNote", e.target.value || null)}
                    placeholder="Printed footer note"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">License label</label>
                  <Input
                    value={prescriptionBranding.licenseLabel ?? ""}
                    onChange={(e) => updatePrescriptionBranding("licenseLabel", e.target.value || null)}
                    placeholder="PRC Lic. No."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">PTR label</label>
                  <Input
                    value={prescriptionBranding.ptrLabel ?? ""}
                    onChange={(e) => updatePrescriptionBranding("ptrLabel", e.target.value || null)}
                    placeholder="PTR No."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">PTR number</label>
                  <Input
                    value={prescriptionBranding.ptrNumber ?? ""}
                    onChange={(e) => updatePrescriptionBranding("ptrNumber", e.target.value || null)}
                    placeholder="052386"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50/70 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={prescriptionBranding.showWatermark}
                  onChange={(e) => updatePrescriptionBranding("showWatermark", e.target.checked)}
                />
                <span>
                  <strong>Show center watermark</strong>
                  <span className="block text-neutral-500 text-xs mt-0.5">
                    Keeps the faded logo visible behind prescription content when a watermark image is uploaded.
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
