"use client"

import * as React from "react"
import { History, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { MedicalHistoryRecord } from "@/lib/patients/medical-history-service"

function diffField(
  label: string,
  before: string[],
  after: string[]
): { label: string; added: string[]; removed: string[]; unchanged: string[] } {
  const beforeSet = new Set(before.map((v) => v.toLowerCase()))
  const afterSet = new Set(after.map((v) => v.toLowerCase()))
  return {
    label,
    added: after.filter((v) => !beforeSet.has(v.toLowerCase())),
    removed: before.filter((v) => !afterSet.has(v.toLowerCase())),
    unchanged: after.filter((v) => beforeSet.has(v.toLowerCase()) && afterSet.has(v.toLowerCase())),
  }
}

interface MedicalHistoryVersionDrawerProps {
  versions: MedicalHistoryRecord[]
  open: boolean
  onClose: () => void
}

export function MedicalHistoryVersionDrawer({
  versions,
  open,
  onClose,
}: MedicalHistoryVersionDrawerProps) {
  const [compareA, setCompareA] = React.useState<number | "">("")
  const [compareB, setCompareB] = React.useState<number | "">("")

  React.useEffect(() => {
    if (open && versions.length >= 2) {
      setCompareA(versions[1]?.version ?? "")
      setCompareB(versions[0]?.version ?? "")
    }
  }, [open, versions])

  if (!open) return null

  const recordA = versions.find((v) => v.version === compareA)
  const recordB = versions.find((v) => v.version === compareB)

  const diffs =
    recordA && recordB
      ? [
          diffField("Allergies", recordA.allergies, recordB.allergies),
          diffField("Medications", recordA.medications, recordB.medications),
          diffField("Conditions", recordA.conditions, recordB.conditions),
        ]
      : []

  const notesChanged =
    recordA && recordB && (recordA.notes ?? "") !== (recordB.notes ?? "")

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md bg-white shadow-xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-neutral-500" />
            <h2 className="font-semibold text-neutral-950">Version history</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All versions</CardTitle>
              <CardDescription>{versions.length} saved record{versions.length === 1 ? "" : "s"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {versions.length === 0 ? (
                <p className="text-sm text-neutral-500">No versions yet.</p>
              ) : (
                versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between text-sm border border-neutral-100 rounded-md px-3 py-2"
                  >
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-neutral-500 text-xs">
                      {new Date(v.created_at).toLocaleString("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {versions.length >= 2 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Compare versions</CardTitle>
                <CardDescription>See what changed between two snapshots.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-600">From</label>
                    <select
                      value={compareA}
                      onChange={(e) => setCompareA(Number(e.target.value))}
                      className="w-full h-9 rounded-md border border-neutral-300 px-2 text-sm"
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.version}>
                          v{v.version}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-600">To</label>
                    <select
                      value={compareB}
                      onChange={(e) => setCompareB(Number(e.target.value))}
                      className="w-full h-9 rounded-md border border-neutral-300 px-2 text-sm"
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.version}>
                          v{v.version}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {recordA && recordB && compareA === compareB && (
                  <p className="text-sm text-amber-700">Select two different versions to compare.</p>
                )}

                {recordA && recordB && compareA !== compareB && (
                  <div className="space-y-4 text-sm">
                    {diffs.map((d) => (
                      <div key={d.label}>
                        <p className="font-medium text-neutral-900 mb-1">{d.label}</p>
                        {d.added.length === 0 && d.removed.length === 0 ? (
                          <p className="text-neutral-500 text-xs">No changes</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {d.removed.map((item) => (
                              <Badge key={`-${item}`} variant="danger" className="text-xs">
                                − {item}
                              </Badge>
                            ))}
                            {d.added.map((item) => (
                              <Badge key={`+${item}`} variant="success" className="text-xs">
                                + {item}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <div>
                      <p className="font-medium text-neutral-900 mb-1">Notes</p>
                      {notesChanged ? (
                        <div className="space-y-2 text-xs">
                          <p className="text-red-700 line-through">{recordA.notes || "—"}</p>
                          <p className="text-success-700">{recordB.notes || "—"}</p>
                        </div>
                      ) : (
                        <p className="text-neutral-500 text-xs">No changes</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
