"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useBranch } from "@/hooks/use-branch"
import { Badge } from "@/components/ui/badge"
import { Users, RefreshCw, BarChart2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DentistStat {
  provider_id: string
  provider_name: string
  appointment_count: number
  completed_count: number
  total_revenue: number
  noshow_count: number
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
})

export function DentistProductivityPanel() {
  const { activeBranch } = useBranch()
  const [stats, setStats] = React.useState<DentistStat[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [timeRange, setTimeRange] = React.useState<"all" | "today" | "7days" | "30days">("all")
  const [selectedDentist, setSelectedDentist] = React.useState<string>("all")
  const [availableDentists, setAvailableDentists] = React.useState<{ id: string; name: string }[]>([])

  const loadStats = React.useCallback(async () => {
    if (!activeBranch?.id) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const cutoff =
        timeRange === "all"
          ? null
          : (() => {
              const now = new Date()
              const c = new Date()
              if (timeRange === "today") c.setHours(0, 0, 0, 0)
              else if (timeRange === "7days") c.setDate(now.getDate() - 7)
              else c.setDate(now.getDate() - 30)
              return c.toISOString()
            })()

      let apptQuery = supabase
        .from("appointments")
        .select("id, status, provider_id, scheduled_at, profiles!provider_id(full_name)")
        .eq("branch_id", activeBranch.id)

      if (cutoff) {
        apptQuery = apptQuery.gte("scheduled_at", cutoff)
      }

      let invoiceQuery = supabase
        .from("invoices")
        .select("paid_amount, created_by, created_at, status")
        .eq("branch_id", activeBranch.id)
        .gt("paid_amount", 0)
        .neq("status", "void")

      if (cutoff) {
        invoiceQuery = invoiceQuery.gte("created_at", cutoff)
      }

      const [{ data: appts, error: apptErr }, { data: invoices, error: invErr }] = await Promise.all([
        apptQuery,
        invoiceQuery,
      ])

      if (apptErr) throw apptErr
      if (invErr) throw invErr

      const dentistSet = new Map<string, string>()
      appts?.forEach((appt) => {
        if (appt.provider_id) {
          const name =
            (appt.profiles as { full_name: string } | null)?.full_name ?? "Unknown Dentist"
          dentistSet.set(appt.provider_id, name)
        }
      })
      setAvailableDentists(Array.from(dentistSet.entries()).map(([id, name]) => ({ id, name })))

      let filteredAppts = appts ?? []
      if (selectedDentist !== "all") {
        filteredAppts = filteredAppts.filter((appt) => appt.provider_id === selectedDentist)
      }

      const dentistMap: Record<string, DentistStat> = {}

      filteredAppts.forEach((appt) => {
        if (!appt.provider_id) return
        const providerName =
          (appt.profiles as { full_name: string } | null)?.full_name ?? "Unknown Dentist"

        if (!dentistMap[appt.provider_id]) {
          dentistMap[appt.provider_id] = {
            provider_id: appt.provider_id,
            provider_name: providerName,
            appointment_count: 0,
            completed_count: 0,
            total_revenue: 0,
            noshow_count: 0,
          }
        }

        const stat = dentistMap[appt.provider_id]
        stat.appointment_count++
        if (appt.status === "completed") {
          stat.completed_count++
        } else if (appt.status === "no_show") {
          stat.noshow_count++
        }
      })

      // Attribute collected invoice amounts to the creating staff user when they match a provider.
      for (const inv of invoices ?? []) {
        const creatorId = inv.created_by as string | null
        if (!creatorId) continue
        if (selectedDentist !== "all" && creatorId !== selectedDentist) continue
        if (!dentistMap[creatorId]) {
          const name = dentistSet.get(creatorId)
          if (!name) continue
          dentistMap[creatorId] = {
            provider_id: creatorId,
            provider_name: name,
            appointment_count: 0,
            completed_count: 0,
            total_revenue: 0,
            noshow_count: 0,
          }
        }
        dentistMap[creatorId].total_revenue += Number(inv.paid_amount) || 0
      }

      setStats(Object.values(dentistMap).sort((a, b) => b.completed_count - a.completed_count))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dentist stats")
    } finally {
      setLoading(false)
    }
  }, [activeBranch?.id, timeRange, selectedDentist])

  React.useEffect(() => {
    void loadStats()
  }, [loadStats])

  if (!activeBranch) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary-600" />
            Dentist Productivity &amp; Performance
          </CardTitle>
          <CardDescription>
            Appointments, completions, and collected invoice amounts attributed to the clinician who
            created the invoice.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadStats()} disabled={loading} className="gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>

      <div className="flex flex-wrap items-center gap-4 border-b border-neutral-100 px-6 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Date Range:
          </span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as "all" | "today" | "7days" | "30days")}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Dentist:
          </span>
          <select
            value={selectedDentist}
            onChange={(e) => setSelectedDentist(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">All dentists</option>
            {availableDentists.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-red-600">
            <ShieldAlert className="mb-2 h-8 w-8" />
            <p className="text-sm font-medium">Failed to load dentist productivity</p>
            <p className="mt-1 text-xs text-neutral-500">{error}</p>
          </div>
        ) : stats.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            No dentist performance records found for this branch.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-100">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Clinician</th>
                  <th className="px-4 py-3 text-center font-semibold">Appointments</th>
                  <th className="px-4 py-3 text-center font-semibold">Completed Visits</th>
                  <th className="px-4 py-3 text-center font-semibold">No-Show rate</th>
                  <th className="px-4 py-3 text-right font-semibold">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {stats.map((stat) => {
                  const noShowRate =
                    stat.appointment_count > 0
                      ? Math.round((stat.noshow_count / stat.appointment_count) * 100)
                      : 0
                  return (
                    <tr key={stat.provider_id} className="hover:bg-neutral-50/50">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-900">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-neutral-400" />
                          {stat.provider_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-neutral-600">
                        {stat.appointment_count}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-semibold text-neutral-900">{stat.completed_count}</span>
                          <span className="text-xs text-neutral-400">
                            (
                            {stat.appointment_count > 0
                              ? Math.round((stat.completed_count / stat.appointment_count) * 100)
                              : 0}
                            %)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={noShowRate > 20 ? "danger" : noShowRate > 10 ? "warning" : "success"}
                        >
                          {noShowRate}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {phpFormatter.format(stat.total_revenue)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
