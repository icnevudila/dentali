"use client"

import * as React from "react"
import { Clock, LogIn, LogOut, RefreshCw } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import {
  clockInStaff,
  clockOutStaff,
  fetchOpenTimeEntry,
  fetchRecentTimeEntries,
  formatDurationMinutes,
  type StaffTimeEntry,
} from "@/lib/staff/timesheet-service"
import { notify } from "@/lib/ui/notify"

export default function TimesheetPage() {
  const { activeBranch } = useBranch()
  const { t, locale } = useLocale()
  const [openEntry, setOpenEntry] = React.useState<StaffTimeEntry | null>(null)
  const [history, setHistory] = React.useState<StaffTimeEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState<"in" | "out" | null>(null)

  const dateLocale = locale === "tr" ? "tr-PH" : locale === "fil" ? "fil-PH" : "en-PH"

  const load = React.useCallback(async () => {
    setLoading(true)
    const [openRes, historyRes] = await Promise.all([fetchOpenTimeEntry(), fetchRecentTimeEntries()])
    setOpenEntry(openRes.data)
    setHistory(historyRes.data)
    setError(openRes.error ?? historyRes.error)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleClockIn = async () => {
    if (!activeBranch) {
      notify.error(t("timesheet.noBranch", "Select an active branch before clocking in."))
      return
    }
    setBusy("in")
    const res = await clockInStaff(activeBranch.id, note.trim() || undefined)
    setBusy(null)
    if (res.error) {
      notify.error(res.error)
      return
    }
    notify.success(t("timesheet.clockedIn", "Clocked in"))
    setNote("")
    await load()
  }

  const handleClockOut = async () => {
    setBusy("out")
    const res = await clockOutStaff(note.trim() || undefined)
    setBusy(null)
    if (res.error) {
      notify.error(res.error)
      return
    }
    notify.success(t("timesheet.clockedOut", "Clocked out"))
    setNote("")
    await load()
  }

  const isClockedIn = openEntry != null

  return (
    <DirectionalTransition>
      <ModulePageShell
        eyebrow={t("timesheet.eyebrow", "Administration")}
        icon={Clock}
        title={t("nav.timesheet", "Timesheet")}
        description={t(
          "timesheet.description",
          "Clock in and out for your shift. Recent entries use Asia/Manila clinic time."
        )}
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {t("common.refresh", "Refresh")}
          </Button>
        }
      >
        {loading ? (
          <PageLoadingSkeleton variant="detail" />
        ) : error ? (
          <Card className="border-red-200 bg-red-50/60">
            <CardContent className="py-6">
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                {t("common.retry", "Retry")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">{t("timesheet.currentShift", "Current shift")}</CardTitle>
                <Badge variant={isClockedIn ? "success" : "outline"}>
                  {isClockedIn
                    ? t("timesheet.statusIn", "Clocked in")
                    : t("timesheet.statusOut", "Not clocked in")}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {isClockedIn ? (
                  <p className="text-sm text-neutral-600">
                    {t("timesheet.since", "Since")}{" "}
                    <span className="font-medium text-neutral-900">
                      {new Date(openEntry.clock_in_at).toLocaleString(dateLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-neutral-600">
                    {activeBranch
                      ? t("timesheet.readyToClockIn", "Ready to clock in at {branch}.").replace(
                          "{branch}",
                          activeBranch.name
                        )
                      : t("timesheet.noBranch", "Select an active branch before clocking in.")}
                  </p>
                )}

                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("timesheet.notePlaceholder", "Optional note")}
                  disabled={busy != null}
                />

                <div className="flex flex-wrap gap-2">
                  {!isClockedIn ? (
                    <Button className="gap-2" disabled={busy != null || !activeBranch} onClick={() => void handleClockIn()}>
                      <LogIn className="h-4 w-4" aria-hidden />
                      {busy === "in" ? t("common.saving", "Saving…") : t("timesheet.clockIn", "Clock in")}
                    </Button>
                  ) : (
                    <Button className="gap-2" disabled={busy != null} onClick={() => void handleClockOut()}>
                      <LogOut className="h-4 w-4" aria-hidden />
                      {busy === "out" ? t("common.saving", "Saving…") : t("timesheet.clockOut", "Clock out")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("timesheet.recent", "Recent entries")}</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-neutral-500">{t("timesheet.empty", "No timesheet entries yet.")}</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {history.map((entry) => (
                      <li key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-neutral-900">
                            {new Date(entry.clock_in_at).toLocaleString(dateLocale, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                            {entry.clock_out_at
                              ? ` → ${new Date(entry.clock_out_at).toLocaleTimeString(dateLocale, {
                                  timeStyle: "short",
                                })}`
                              : ` · ${t("timesheet.open", "Open")}`}
                          </p>
                          {entry.note ? <p className="text-xs text-neutral-500">{entry.note}</p> : null}
                        </div>
                        <span className="text-neutral-600 tabular-nums">
                          {formatDurationMinutes(entry.clock_in_at, entry.clock_out_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </ModulePageShell>
    </DirectionalTransition>
  )
}
