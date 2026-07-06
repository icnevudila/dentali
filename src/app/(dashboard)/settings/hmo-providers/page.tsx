"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { createClient } from "@/lib/supabase/client"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { useLocale } from "@/hooks/use-locale"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { Plus, ShieldAlert, Check, X, ShieldCheck } from "lucide-react"

interface HmoProvider {
  id: string
  name: string
  code: string | null
  is_active: boolean
  created_at: string
}

export default function HmoProvidersSettingsPage() {
  const { t } = useLocale()
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<HmoProvider[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form states
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("hmo_providers")
      .select("*")
      .order("name", { ascending: true })

    if (err) {
      setError(err.message)
    } else {
      setProviders(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchOrganization().then((org) => {
      if (org?.id) setOrganizationId(org.id)
    })
    void load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !organizationId) return

    setSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    const supabase = createClient()
    const { error: err } = await supabase
      .from("hmo_providers")
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        code: code.trim() || null,
        is_active: true,
      })

    setSubmitting(false)
    if (err) {
      setError(err.message)
    } else {
      setSuccessMsg("HMO Provider created successfully!")
      setName("")
      setCode("")
      setShowForm(false)
      void load()
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    setError(null)
    setSuccessMsg(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from("hmo_providers")
      .update({ is_active: !currentStatus })
      .eq("id", id)

    if (err) {
      setError(err.message)
    } else {
      setSuccessMsg("HMO Provider status updated!")
      void load()
    }
  }

  if (loading) {
    return (
      <ModulePageShell title="HMO Providers" eyebrow="Clinic settings" icon={ShieldCheck}>
        <PageLoadingSkeleton />
      </ModulePageShell>
    )
  }

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell title="HMO Providers" eyebrow="Clinic settings" icon={ShieldCheck}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">HMO Providers</h1>
              <p className="text-neutral-500 mt-1">Manage health insurance providers and clinic claims codes.</p>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add HMO Provider
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2 animate-in fade-in">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 flex items-start gap-2 animate-in fade-in">
              <Check className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {showForm && (
            <Card className="border border-neutral-200 shadow-sm animate-in slide-in-from-top-4 duration-300">
              <CardHeader>
                <CardTitle>New HMO Provider</CardTitle>
                <CardDescription>Enter the provider registration and billing codes.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Provider Name</label>
                      <Input
                        required
                        placeholder="e.g. Maxicare"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Provider Code</label>
                      <Input
                        placeholder="e.g. MAXI_PH"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Adding…" : "Add Provider"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="border border-neutral-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/50">
                    <th className="p-4 font-semibold text-neutral-600">Provider Name</th>
                    <th className="p-4 font-semibold text-neutral-600">Provider Code</th>
                    <th className="p-4 font-semibold text-neutral-600">Status</th>
                    <th className="p-4 font-semibold text-neutral-600">Created At</th>
                    <th className="p-4 font-semibold text-neutral-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {providers.length > 0 ? (
                    providers.map((row) => (
                      <tr key={row.id} className="hover:bg-neutral-50/30 transition-colors">
                        <td className="p-4 font-medium text-neutral-900">{row.name}</td>
                        <td className="p-4 font-mono text-xs text-neutral-500">{row.code || "—"}</td>
                        <td className="p-4">
                          <Badge variant={row.is_active ? "success" : "default"}>
                            {row.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="p-4 text-neutral-500">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(row.id, row.is_active)}
                            className="text-neutral-600 hover:text-neutral-900"
                          >
                            {row.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-neutral-400">
                        No HMO Providers configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </ModulePageShell>
    </PermissionGate>
  )
}
