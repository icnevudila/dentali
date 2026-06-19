"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale } from "@/hooks/use-locale"
import { useBranch } from "@/hooks/use-branch"
import { fetchActiveLabCases, updateLabCaseStatus, type PatientWithLabCase } from "@/lib/clinical/lab-service"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { CollapsibleBelowFold } from "@/components/layout/CollapsibleBelowFold"
import { StickyActionBar } from "@/components/layout/StickyActionBar"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { FlaskConical, Plus, CheckCircle2, Clock, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NewLabCaseDialog } from "@/components/clinical/lab/NewLabCaseDialog"
import { formatCurrency } from "@/lib/i18n/translate"
import { toast } from "sonner"

const TODAY_KEY = new Date().toISOString().slice(0, 10)

function labCaseUrgency(c: PatientWithLabCase) {
  if (c.status === "received") return "received"
  if (c.expected_date && c.expected_date < TODAY_KEY) return "overdue"
  if (c.expected_date && c.expected_date <= TODAY_KEY) return "due_today"
  return "pending"
}

export default function LabCasesPage() {
  const { t, locale } = useLocale()
  const { activeBranch } = useBranch()
  const [cases, setCases] = React.useState<PatientWithLabCase[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const loadCases = React.useCallback(async () => {
    if (!activeBranch?.id) return
    setLoading(true)
    const { data, error } = await fetchActiveLabCases(activeBranch.id)
    if (error) toast.error(error)
    setCases(data)
    setLoading(false)
  }, [activeBranch])

  const handleLabCaseCreated = React.useCallback(
    async (created?: PatientWithLabCase) => {
      if (created) {
        setCases((prev) => {
          const exists = prev.some((c) => c.id === created.id)
          if (exists) return prev
          return [created, ...prev]
        })
        setLoading(false)
      }
      await loadCases()
    },
    [loadCases]
  )

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      loadCases()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadCases])

  const caseStats = React.useMemo(() => {
    const pending = cases.filter((c) => c.status === "pending")
    return {
      pending: pending.length,
      overdue: pending.filter((c) => labCaseUrgency(c) === "overdue").length,
      dueToday: pending.filter((c) => labCaseUrgency(c) === "due_today").length,
      received: cases.filter((c) => c.status === "received").length,
    }
  }, [cases])

  const sortedCases = React.useMemo(
    () =>
      [...cases].sort((a, b) => {
        const rank = { overdue: 0, due_today: 1, pending: 2, received: 3 } as Record<string, number>
        const urgencyDiff = rank[labCaseUrgency(a)] - rank[labCaseUrgency(b)]
        if (urgencyDiff !== 0) return urgencyDiff
        return (a.expected_date ?? "9999-12-31").localeCompare(b.expected_date ?? "9999-12-31")
      }),
    [cases]
  )

  const handleMarkReceived = async (id: string) => {
    const { error } = await updateLabCaseStatus(id, "received")
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("labcases.markedReceived", "Lab case marked as received!"))
      loadCases()
    }
  }

  const handleCancel = async (id: string) => {
    const { error } = await updateLabCaseStatus(id, "cancelled")
    if (error) toast.error(error)
    else loadCases()
  }

  return (
    <DirectionalTransition className="mx-auto w-full max-w-7xl">
      <ContentPanel padding="lg" className="space-y-6">
        <SectionEyebrow icon={FlaskConical}>
          {t("labcases.eyebrow", "Clinical")} · {t("labcases.module", "Lab Cases")}
        </SectionEyebrow>

        <PageHeader
          compact
          title={t("labcases.title", "Laboratory Cases")}
          description={t("labcases.description", "Track impressions, crowns, and external lab orders.")}
          actions={
            <Button size="sm" className="hidden gap-2 md:inline-flex" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("labcases.new", "New Lab Case")}
            </Button>
          }
        />

        <StickyActionBar>
          <Button className="h-11 w-full gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 shrink-0" />
            {t("labcases.new", "New Lab Case")}
          </Button>
        </StickyActionBar>

        {loading ? (
          <div className="py-12 text-center text-sm text-neutral-500 animate-pulse">
            {t("labcases.loading", "Loading cases...")}
          </div>
        ) : cases.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-16 text-neutral-500">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
              <p className="font-medium text-neutral-800">{t("labcases.emptyTitle", "No active lab cases")}</p>
              <p className="mt-1 text-sm text-neutral-500">
                {t("labcases.emptyHint", "When you send an impression to an external lab, track it here.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedCases.map((c) => {
              const urgency = labCaseUrgency(c)
              return (
              <Card
                key={c.id}
                className={
                  urgency === "overdue"
                    ? "border-red-200 bg-red-50/30"
                    : urgency === "due_today"
                      ? "border-amber-200 bg-amber-50/30"
                      : c.status === "received"
                        ? "border-emerald-200 bg-emerald-50/30"
                        : ""
                }
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={`/patients/${c.patient_id}`} className="font-semibold text-neutral-900 hover:text-primary-700 hover:underline">
                        {c.patients?.first_name} {c.patients?.last_name}
                      </Link>
                      <p className="text-xs text-neutral-500">{c.case_type}</p>
                    </div>
                    {urgency === "overdue" ? (
                      <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">
                        <Clock className="w-3 h-3 mr-1" /> {t("labcases.overdue", "Overdue")}
                      </Badge>
                    ) : urgency === "due_today" ? (
                      <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" /> {t("labcases.dueToday", "Due today")}
                      </Badge>
                    ) : c.status === "pending" ? (
                      <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" /> {t("labcases.pending", "Pending")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {t("labcases.received", "Received")}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50 rounded-md p-2 border">
                    <div>
                      <p className="text-neutral-400 font-medium">{t("labcases.lab", "Lab")}</p>
                      <p className="text-neutral-700 truncate">{c.lab_name}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">{t("labcases.cost", "Cost")}</p>
                      <p className="text-neutral-700">{formatCurrency(locale, c.cost)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">{t("labcases.sent", "Sent")}</p>
                      <p className="text-neutral-700">{c.sent_date}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">{t("labcases.expected", "Expected")}</p>
                      <p className="text-neutral-700">{c.expected_date || t("labcases.tbd", "TBD")}</p>
                    </div>
                  </div>

                  {c.notes && (
                    <p className="text-xs text-neutral-500 bg-white p-2 rounded border border-dashed">
                      <span className="font-medium text-neutral-700">{t("labcases.notes", "Notes")}: </span>{c.notes}
                    </p>
                  )}

                  {c.status === "pending" && (
                    <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                      <Button variant="outline" size="sm" className="h-8" asChild>
                        <Link href={`/patients/${c.patient_id}`}>{t("labcases.patient", "Patient")}</Link>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleCancel(c.id)}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> {t("labcases.cancel", "Cancel")}
                      </Button>
                      <Button variant="secondary" size="sm" className="h-8" onClick={() => handleMarkReceived(c.id)}>
                        {t("labcases.markReceived", "Mark Received")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )})}
          </div>
        )}

        <CollapsibleBelowFold summary={t("labcases.statsToggle", "Lab case stats")}>
          <MetricStrip
            items={[
              {
                label: t("labcases.overdue", "Overdue"),
                value: loading ? "—" : caseStats.overdue,
                variant: caseStats.overdue > 0 ? ("warning" as const) : undefined,
              },
              {
                label: t("labcases.dueToday", "Due today"),
                value: loading ? "—" : caseStats.dueToday,
                variant: caseStats.dueToday > 0 ? ("warning" as const) : undefined,
              },
              {
                label: t("labcases.pending", "Pending"),
                value: loading ? "—" : caseStats.pending,
              },
              {
                label: t("labcases.received", "Received"),
                value: loading ? "—" : caseStats.received,
                variant: caseStats.received > 0 ? ("success" as const) : undefined,
              },
            ]}
            className="lg:grid-cols-4"
          />
        </CollapsibleBelowFold>

      </ContentPanel>

      <NewLabCaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleLabCaseCreated}
      />
    </DirectionalTransition>
  )
}
