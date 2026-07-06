"use client"

import * as React from "react"
import { fetchUnifiedAuditTrail, type AuditLogRecord } from "@/lib/audit/audit-log-service"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollText, RefreshCw, Clock, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PatientAuditPanelProps {
  patientId: string
}

export function PatientAuditPanel({ patientId }: PatientAuditPanelProps) {
  const [logs, setLogs] = React.useState<AuditLogRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadLogs = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await fetchUnifiedAuditTrail({
      limit: 50,
      entityId: patientId,
    })
    if (err) setError(err)
    else setLogs(data)
    setLoading(false)
  }, [patientId])

  React.useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary-600" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            History of operations and updates related to this patient record.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading} className="gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-red-600">
            <ShieldAlert className="h-8 w-8 mb-2" />
            <p className="text-sm font-medium">Failed to load audit logs</p>
            <p className="text-xs text-neutral-500 mt-1">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-8">
            No audit logs found for this patient.
          </p>
        ) : (
          <div className="overflow-hidden border border-neutral-100 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 border-b border-neutral-100 text-neutral-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Clock className="h-3 w-3 text-neutral-400" />
                        {new Date(log.created_at).toLocaleString("en-PH")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-900">{log.action}</span>
                      {log.entity_type && (
                        <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                          {log.entity_type.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 font-medium">
                      {log.actor_name ?? "System"}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 font-mono">
                      {log.ip_address ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
