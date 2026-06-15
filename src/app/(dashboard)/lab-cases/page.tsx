"use client"

import * as React from "react"
import { useLocale } from "@/hooks/use-locale"
import { useBranch } from "@/hooks/use-branch"
import { fetchActiveLabCases, updateLabCaseStatus, type PatientWithLabCase } from "@/lib/clinical/lab-service"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { FlaskConical, Plus, CheckCircle2, Clock, XCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NewLabCaseDialog } from "@/components/clinical/lab/NewLabCaseDialog"
import { formatCurrency } from "@/lib/i18n/translate"
import { toast } from "sonner"

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
  }, [activeBranch?.id])

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
    loadCases()
  }, [loadCases])

  const handleMarkReceived = async (id: string) => {
    const { error } = await updateLabCaseStatus(id, "received")
    if (error) {
      toast.error(error)
    } else {
      toast.success("Lab case marked as received!")
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
          title={t("labcases.title", "Laboratory Cases")}
          description={t("labcases.description", "Track impressions, crowns, and external lab orders.")}
          actions={
            <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("labcases.new", "New Lab Case")}
            </Button>
          }
        />

        {loading ? (
          <div className="py-12 text-center text-sm text-neutral-500 animate-pulse">Loading cases...</div>
        ) : cases.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-16 text-neutral-500">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 text-neutral-300" />
              <p className="font-medium text-neutral-800">No active lab cases</p>
              <p className="mt-1 text-sm text-neutral-500">
                When you send an impression to an external lab, track it here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cases.map((c) => (
              <Card key={c.id} className={c.status === "received" ? "border-emerald-200 bg-emerald-50/30" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {c.patients?.first_name} {c.patients?.last_name}
                      </p>
                      <p className="text-xs text-neutral-500">{c.case_type}</p>
                    </div>
                    {c.status === "pending" ? (
                      <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" /> Pending
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Received
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50 rounded-md p-2 border">
                    <div>
                      <p className="text-neutral-400 font-medium">Lab</p>
                      <p className="text-neutral-700 truncate">{c.lab_name}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">Cost</p>
                      <p className="text-neutral-700">{formatCurrency(locale, c.cost)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">Sent</p>
                      <p className="text-neutral-700">{c.sent_date}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 font-medium">Expected</p>
                      <p className="text-neutral-700">{c.expected_date || "TBD"}</p>
                    </div>
                  </div>

                  {c.notes && (
                    <p className="text-xs text-neutral-500 bg-white p-2 rounded border border-dashed">
                      <span className="font-medium text-neutral-700">Notes: </span>{c.notes}
                    </p>
                  )}

                  {c.status === "pending" && (
                    <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                      <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleCancel(c.id)}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                      <Button variant="secondary" size="sm" className="h-8" onClick={() => handleMarkReceived(c.id)}>
                        Mark Received
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </ContentPanel>

      <NewLabCaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleLabCaseCreated}
      />
    </DirectionalTransition>
  )
}
