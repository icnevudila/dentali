"use client"

import * as React from "react"
import { Clock, Users, Timer, Activity, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useLocale } from "@/hooks/use-locale"
import { fetchQueueEntries } from "@/lib/queue/queue-service"

export function ChairTimeAnalyticsPanel({ branchId }: { branchId: string }) {
  const { t } = useLocale()
  const [loading, setLoading] = React.useState(true)
  const [entries, setEntries] = React.useState<any[]>([])

  React.useEffect(() => {
    if (!branchId) return
    fetchQueueEntries(branchId, false).then(({ data }) => {
      setEntries(data || [])
      setLoading(false)
    })
  }, [branchId])

  // Calculate averages
  const servedEntries = entries.filter((e) => e.status === "served" && e.in_chair_at && e.completed_at)

  const totalChairTimeMins = servedEntries.reduce((acc, entry) => {
    const start = new Date(entry.in_chair_at).getTime()
    const end = new Date(entry.completed_at).getTime()
    return acc + Math.max(0, (end - start) / 60000)
  }, 0)

  const totalWaitTimeMins = servedEntries.reduce((acc, entry) => {
    const start = new Date(entry.checked_in_at).getTime()
    const end = new Date(entry.in_chair_at || entry.completed_at).getTime()
    return acc + Math.max(0, (end - start) / 60000)
  }, 0)

  const avgChairTime = servedEntries.length > 0 ? Math.round(totalChairTimeMins / servedEntries.length) : 0
  const avgWaitTime = servedEntries.length > 0 ? Math.round(totalWaitTimeMins / servedEntries.length) : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("chairtime.totalCases", "Total Cases")}</CardTitle>
            <Users className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{servedEntries.length}</div>
            <p className="text-xs text-neutral-500">{t("chairtime.totalCasesDesc", "Total completed patient records")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("chairtime.avgWaitTime", "Average Wait Time")}</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgWaitTime} {t("common.min", "min")}
            </div>
            <p className="text-xs text-neutral-500">{t("chairtime.avgWaitDesc", "Time from check-in to being seated")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">
              {t("chairtime.avgChairTime", "Average Chair Time")}
            </CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {avgChairTime} {t("common.min", "min")}
            </div>
            <p className="text-xs text-neutral-500">{t("chairtime.avgChairDesc", "Time from being seated to checkout")}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary-200 bg-primary-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary-800">
            <Info className="h-5 w-5" /> {t("chairtime.howItWorks", "How does it work?")}
          </CardTitle>
          <CardDescription className="text-primary-600/80">
            {t(
              "chairtime.howItWorksDesc",
              "The system calculates these times **completely autonomously** from patient movements on the Queue screen."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-primary-900/90">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              1
            </div>
            <p>
              {t(
                "chairtime.step1",
                "When the patient arrives and the receptionist performs 'Check-In', the waiting timer starts."
              )}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              2
            </div>
            <p>
              {t(
                "chairtime.step2",
                "When the doctor moves the patient to 'In Chair' status on the Queue screen, the waiting timer stops and the Chair Efficiency Timer starts silently in the background."
              )}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              3
            </div>
            <p>
              {t(
                "chairtime.step3",
                "When the procedure is finished and the patient is marked as 'Served', the timer stops and the data is reflected in this report. No manual time entry by staff is needed!"
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
