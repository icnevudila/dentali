"use client"

import * as React from "react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchOrgConsentTemplates,
  upsertOrgConsentTemplate,
  type ConsentTemplateAdminRow,
} from "@/lib/patients/consent-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ConsentPreviewFrame } from "@/components/consent/ConsentPreviewFrame"
import { ConsentFieldEditor } from "@/components/consent/ConsentFieldEditor"
import { parseConsentFields, type ConsentField } from "@/lib/consent/consent-field-types"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { FileSignature } from "lucide-react"

export default function ConsentTemplatesSettingsPage() {
  const { t } = useLocale()
  const [templates, setTemplates] = React.useState<ConsentTemplateAdminRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editingSlug, setEditingSlug] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [body, setBody] = React.useState("")
  const [version, setVersion] = React.useState("1.0")
  const [isActive, setIsActive] = React.useState(true)
  const [fields, setFields] = React.useState<ConsentField[]>([])
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(() => {
    setLoading(true)
    fetchOrgConsentTemplates().then(({ data, error: err }) => {
      setTemplates(data)
      setError(err)
      setLoading(false)
    })
  }, [])

  React.useEffect(() => { load() }, [load])

  const slugs = React.useMemo(() => {
    const set = new Set<string>()
    for (const tpl of templates) set.add(tpl.slug)
    return [...set].sort()
  }, [templates])

  const startEdit = (slug: string) => {
    const orgOverride = templates.find((t) => t.slug === slug && !t.is_global)
    const global = templates.find((t) => t.slug === slug && t.is_global)
    const source = orgOverride ?? global
    if (!source) return
    setEditingSlug(slug)
    setName(source.name)
    setBody(source.body)
    setVersion(orgOverride?.version ?? `${parseFloat(global?.version ?? "1") + 0.1}`)
    setIsActive(orgOverride?.is_active ?? true)
    setFields(parseConsentFields((orgOverride ?? global)?.fields))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSlug) return
    setSaving(true)
    setError(null)
    const { error: err } = await upsertOrgConsentTemplate({
      slug: editingSlug,
      name: name.trim(),
      body: body.trim(),
      version: version.trim() || "1.0",
      isActive,
      fields,
    })
    setSaving(false)
    if (err) setError(err)
    else {
      setEditingSlug(null)
      load()
    }
  }

  const customCount = slugs.filter((slug) => templates.some((tpl) => tpl.slug === slug && !tpl.is_global)).length

  return (
    <PermissionGate permission={PERMISSIONS.SETTINGS_MANAGE}>
      <ModulePageShell
        maxWidth=""
        className="w-full"
        eyebrow={t("settings.consentEyebrow", "Clinical") + " · " + t("settings.consentTemplatesTitle", "Consent")}
        icon={FileSignature}
        title={t("settings.consentTemplatesTitle", "Consent templates")}
        description={t(
          "settings.consentTemplatesSubtitle",
          "Override global forms with organization-specific text. Patients see the org version when signed."
        )}
        metrics={[
          {
            label: t("settings.metricTemplates", "Templates"),
            value: loading ? "—" : slugs.length,
            hint: t("settings.metricTemplatesHint", "Form types"),
            icon: FileSignature,
          },
          {
            label: t("settings.consentCustom", "Custom"),
            value: loading ? "—" : customCount,
            hint: t("settings.metricCustomHint", "Org overrides"),
            variant: customCount > 0 ? "success" : "default",
          },
        ]}
        metricsClassName="lg:grid-cols-2"
        error={error}
        onRetry={load}
        retryLabel={t("common.retry", "Retry")}
        panel={false}
      >
        {loading ? (
          <PageLoadingSkeleton variant="inline" />
        ) : slugs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-neutral-500">
              <FileSignature className="mx-auto h-10 w-10 text-neutral-300 mb-3" />
              <p className="font-medium text-neutral-700">
                {t("settings.consentEmptyTitle", "No consent templates yet")}
              </p>
              <p className="text-sm mt-1 max-w-md mx-auto">
                {t(
                  "settings.consentEmptyHint",
                  "Run the paper consent migration in Supabase, then refresh. Global templates will appear here for org overrides."
                )}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={load}>
                {t("common.retry", "Refresh")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {slugs.map((slug) => {
              const orgTpl = templates.find((t) => t.slug === slug && !t.is_global)
              const globalTpl = templates.find((t) => t.slug === slug && t.is_global)
              return (
                <Card key={slug}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{globalTpl?.name ?? slug}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline">{slug}</Badge>
                        {orgTpl ? (
                          <Badge variant="success">{t("settings.consentCustom", "Custom")} v{orgTpl.version}</Badge>
                        ) : (
                          <Badge variant="outline">{t("settings.consentGlobal", "Global")} v{globalTpl?.version}</Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="line-clamp-2">{globalTpl?.body}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" onClick={() => startEdit(slug)}>
                      {orgTpl ? t("settings.consentEdit", "Edit override") : t("settings.consentCreateOverride", "Create org override")}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {editingSlug && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-primary-200">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("settings.consentEditing", "Editing")}: {editingSlug}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-3">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("settings.consentName", "Display name")} required />
                  <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder={t("settings.consentVersion", "Version")} />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    rows={12}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    placeholder={t("settings.consentBody", "Template body")}
                  />
                  <ConsentFieldEditor fields={fields} onChange={setFields} />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    {t("settings.consentActive", "Active")}
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>{t("common.save", "Save")}</Button>
                    <Button type="button" variant="outline" onClick={() => setEditingSlug(null)}>{t("common.cancel", "Cancel")}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <ConsentPreviewFrame title={name} body={body} version={version} fields={fields} />
          </div>
        )}
      </ModulePageShell>
    </PermissionGate>
  )
}
