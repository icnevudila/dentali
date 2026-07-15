"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import {
  fetchProcedures,
  createProcedure,
  seedDefaultProcedures,
  upsertBranchProcedurePrice,
  clearBranchProcedurePrice,
  bulkUpsertProcedures,
} from "@/lib/billing/procedure-service"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { useBranch } from "@/hooks/use-branch"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import type { ProcedureCategory, ProcedureRecord } from "@/lib/billing/procedure-service"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { ProcedureBomEditor } from "@/components/settings/ProcedureBomEditor"
import { ListOrdered } from "lucide-react"
import {
  fetchOrganizationPreferences,
} from "@/lib/settings/org-preferences-service"

const PROCEDURE_TEMPLATES = [
  { code: "EXAM", name: "Oral Examination", price: "500", category: "preventive" },
  { code: "PROPH", name: "Prophylaxis / Cleaning", price: "2500", category: "preventive" },
  { code: "FILL", name: "Composite Filling", price: "3500", category: "restorative" },
  { code: "RCT", name: "Root Canal Treatment", price: "12000", category: "restorative" },
  { code: "EXT", name: "Tooth Extraction", price: "4000", category: "surgery" },
  { code: "CRWN", name: "Jacket Crown", price: "15000", category: "restorative" },
  { code: "PFM", name: "PFM Crown", price: "1500", category: "restorative" },
  { code: "ZIRC", name: "Zirconia Crown (Single)", price: "2500", category: "restorative" },
  { code: "EMAX", name: "E-Max Veneer", price: "3500", category: "restorative" },
  { code: "NG", name: "Nightguard (Hard/Soft)", price: "1200", category: "preventive" },
  { code: "DENT", name: "Complete Denture (Upper & Lower)", price: "5000", category: "prosthodontics" },
]

export default function ProceduresSettingsPage() {
  const { activeBranch, availableBranches } = useBranch()
  const { user } = useAuth()
  const { t } = useLocale()
  const [selectedBranchId, setSelectedBranchId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [procedures, setProcedures] = useState<ProcedureRecord[]>([])
  const [categories, setCategories] = useState<ProcedureCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [price, setPrice] = useState("")
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editPrices, setEditPrices] = useState<Record<string, string>>({})
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [bomProcedureId, setBomProcedureId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [branchPricingEnabled, setBranchPricingEnabled] = useState(false)

  const IMPORT_EXAMPLE = `[
  {"code":"EXAM","name":"Oral Examination","category":"preventive","base_price":500},
  {"code":"FILL","name":"Composite Filling","category":"restorative","base_price":3500}
]`

  useEffect(() => {
    void fetchOrganization().then((org) => {
      if (org?.id) setOrganizationId(org.id)
    })
    void fetchOrganizationPreferences().then(({ data }) => {
      if (data) setBranchPricingEnabled(data.branch_procedure_pricing_enabled)
    })
  }, [])

  useEffect(() => {
    if (activeBranch && !selectedBranchId) setSelectedBranchId(activeBranch.id)
  }, [activeBranch, selectedBranchId])

  const load = async () => {
    setLoading(true)
    const { data, error: err, categories: cats } = await fetchProcedures(selectedBranchId || null)
    setProcedures(data)
    setCategories(cats ?? [])
    setError(err)
    const prices: Record<string, string> = {}
    for (const p of data) {
      if (p.branch_override != null) prices[p.id] = String(p.branch_override)
    }
    setEditPrices(prices)
    setLoading(false)
  }

  useEffect(() => {
    if (selectedBranchId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId])

  const handleSeed = async () => {
    const org = await fetchOrganization()
    if (!org) return
    await seedDefaultProcedures(org.id)
    await load()
  }

  const handleCreate = async () => {
    const org = await fetchOrganization()
    if (!org || !name.trim()) return
    setCreating(true)
    const { error: err } = await createProcedure({
      organizationId: org.id,
      name: name.trim(),
      code: code.trim() || undefined,
      basePrice: parseFloat(price) || 0,
    })
    setCreating(false)
    if (err) setError(err)
    else {
      setName("")
      setCode("")
      setPrice("")
      setShowForm(false)
      await load()
    }
  }

  const saveBranchPrice = async (procedure: ProcedureRecord) => {
    if (!user || !selectedBranchId) return
    const org = await fetchOrganization()
    if (!org) return

    const raw = editPrices[procedure.id]?.trim()
    setSavingId(procedure.id)
    setError(null)

    if (!raw) {
      const { error: err } = await clearBranchProcedurePrice(selectedBranchId, procedure.id)
      if (err) setError(err)
      else await load()
    } else {
      const val = parseFloat(raw)
      if (Number.isNaN(val) || val < 0) {
        setError("Enter a valid price.")
        setSavingId(null)
        return
      }
      const { error: err } = await upsertBranchProcedurePrice({
        organizationId: org.id,
        branchId: selectedBranchId,
        procedureId: procedure.id,
        priceOverride: val,
        userId: user.id,
      })
      if (err) setError(err)
      else await load()
    }
    setSavingId(null)
  }

  const parseImportRows = (raw: string) => {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) throw new Error("JSON must be an array of procedures.")
    return parsed.map((row, index) => {
      if (!row || typeof row !== "object") {
        throw new Error(`Row ${index + 1} is not an object.`)
      }
      const item = row as Record<string, unknown>
      const name = String(item.name ?? "").trim()
      if (!name) throw new Error(`Row ${index + 1} is missing name.`)
      return {
        code: item.code != null ? String(item.code).trim() : undefined,
        name,
        category: item.category != null ? String(item.category).trim() : undefined,
        base_price: item.base_price != null ? Number(item.base_price) : undefined,
        tooth_required: item.tooth_required != null ? Boolean(item.tooth_required) : undefined,
        is_active: item.is_active != null ? Boolean(item.is_active) : undefined,
      }
    })
  }

  const handleBulkImport = async () => {
    const org = await fetchOrganization()
    if (!org || !importText.trim()) return
    setImporting(true)
    setError(null)
    setImportResult(null)
    try {
      const rows = parseImportRows(importText.trim())
      const { data, error: err } = await bulkUpsertProcedures(org.id, rows)
      if (err) setError(err)
      else if (data) {
        setImportResult(`Imported ${data.total} procedure(s): ${data.inserted} new, ${data.updated} updated.`)
        setImportText("")
        setShowImport(false)
        await load()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid import JSON")
    }
    setImporting(false)
  }

  const visibleProcedures =
    categoryFilter === "all"
      ? procedures
      : procedures.filter((p) => p.category === categoryFilter)

  const branchLabel = availableBranches.find((b) => b.id === selectedBranchId)?.name
  const bomProcedure = bomProcedureId
    ? procedures.find((p) => p.id === bomProcedureId) ?? null
    : null

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("settings.proceduresEyebrow", "Billing") + " · " + t("settings.proceduresTitle", "Procedures")}
        icon={ListOrdered}
        title={t("settings.proceduresTitle", "Procedure Catalog")}
        description={t("settings.proceduresSubtitle", "Org-wide base prices and per-branch overrides (PHP).")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSeed}>
              {t("settings.loadDefaults", "Load Defaults")}
            </Button>
            <Button variant="outline" onClick={() => setShowImport(!showImport)}>
              {showImport
                ? t("settings.closeImport", "Close import")
                : t("settings.bulkImport", "Bulk import")}
            </Button>
            <Button className="shadow-sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? t("common.cancel", "Cancel") : t("settings.addProcedure", "Add Procedure")}
            </Button>
          </div>
        }
        badges={
          branchLabel ? (
            <Badge variant="info" className="font-normal animate-fade-rise">
              {branchLabel}
            </Badge>
          ) : null
        }
        metrics={[
          {
            label: t("settings.metricProcedures", "Procedures"),
            value: loading ? "—" : procedures.length,
            hint: t("settings.metricProceduresHint", "In catalog"),
            icon: ListOrdered,
          },
          {
            label: t("settings.metricCategories", "Categories"),
            value: loading ? "—" : categories.length,
            hint: t("settings.metricCategoriesHint", "Grouped services"),
          },
        ]}
        metricsClassName="lg:grid-cols-2"
        error={error}
        onRetry={() => void load()}
        retryLabel={t("common.retry", "Retry")}
        panel={false}
      >
        {branchPricingEnabled && availableBranches.length > 1 ? (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700">Branch pricing</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-10 rounded-md border border-neutral-300 px-3 text-sm min-w-[200px]"
            >
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            Org-wide base prices only. Enable per-branch pricing in Organization settings when you run multiple large clinics.
          </p>
        )}

        {showImport && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bulk import (JSON)</CardTitle>
              <CardDescription>
                Paste an array of procedures. Existing codes are updated; new codes are inserted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={IMPORT_EXAMPLE}
                className="min-h-[140px] w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
              />
              <div className="flex gap-2">
                <Button onClick={handleBulkImport} disabled={importing || !importText.trim()}>
                  {importing ? "Importing…" : "Run import"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImportText(IMPORT_EXAMPLE)}
                >
                  Load example
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {importResult && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2">
            {importResult}
          </p>
        )}

        {showForm && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {t("settings.proceduresQuickSelect", "Quick select from templates")}
                </label>
                <select
                  onChange={(e) => {
                    const template = PROCEDURE_TEMPLATES.find(t => t.code === e.target.value)
                    if (template) {
                      setName(template.name)
                      setCode(template.code)
                      setPrice(template.price)
                    }
                  }}
                  className="h-10 w-full rounded-md border border-neutral-300 px-3 text-sm bg-white"
                  defaultValue=""
                >
                  <option value="">-- Select a predefined procedure template --</option>
                  {PROCEDURE_TEMPLATES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name} — ₱{t.price} ({t.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
                <Input placeholder="Base price (PHP)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                <Button onClick={handleCreate} disabled={creating}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={categoryFilter === "all" ? "default" : "outline"}
              onClick={() => setCategoryFilter("all")}
            >
              All
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={categoryFilter === c.slug ? "default" : "outline"}
                onClick={() => setCategoryFilter(c.slug)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <PageLoadingSkeleton variant="block" className="h-32" />
        ) : visibleProcedures.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-neutral-500">
              No procedures. Click Load Defaults to seed common dental procedures.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-neutral-50 text-neutral-500">
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Base (PHP)</th>
                    <th className="px-4 py-3 text-right">Branch override</th>
                    <th className="px-4 py-3 text-right">Effective</th>
                    <th className="px-4 py-3 text-right">BOM</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleProcedures.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-mono text-xs">{p.code ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{p.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        ₱{Number(p.base_price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          className="h-8 w-28 ml-auto text-right"
                          placeholder="—"
                          value={editPrices[p.id] ?? ""}
                          onChange={(e) =>
                            setEditPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ₱{Number(p.effective_price).toLocaleString()}
                        {p.branch_override != null && (
                          <Badge variant="info" className="ml-2 text-[10px]">
                            override
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!selectedBranchId || !organizationId}
                          onClick={() => setBomProcedureId(p.id)}
                        >
                          {t("inventory.bom", "BOM")}
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === p.id || !selectedBranchId}
                          onClick={() => saveBranchPrice(p)}
                        >
                          {savingId === p.id ? "…" : "Save"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {bomProcedureId && selectedBranchId && organizationId ? (
          <ProcedureBomEditor
            organizationId={organizationId}
            branchId={selectedBranchId}
            procedureId={bomProcedureId}
            procedureName={bomProcedure?.name ?? "Procedure"}
            onClose={() => setBomProcedureId(null)}
          />
        ) : null}
      </ModulePageShell>
    </PermissionGate>
  )
}
