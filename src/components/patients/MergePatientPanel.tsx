"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, GitMerge } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { mergePatients, searchPatients } from "@/lib/patients/patient-service"
import { useBranch } from "@/hooks/use-branch"

interface MergePatientPanelProps {
  masterPatientId: string
  masterName: string
  onMerged?: () => void
}

export function MergePatientPanel({ masterPatientId, masterName, onMerged }: MergePatientPanelProps) {
  const { activeBranch } = useBranch()
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Awaited<ReturnType<typeof searchPatients>>["data"]>([])
  const [selectedId, setSelectedId] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [merging, setMerging] = React.useState(false)
  const [mergedLabel, setMergedLabel] = React.useState<string | null>(null)
  const [searching, setSearching] = React.useState(false)

  React.useEffect(() => {
    if (query.trim().length < 2 || !activeBranch) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      searchPatients(query.trim(), activeBranch.id).then(({ data }) => {
        setResults(data.filter((p) => p.id !== masterPatientId))
        setSearching(false)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [query, masterPatientId, activeBranch])

  const selected = results.find((p) => p.id === selectedId)

  const formatDob = (dob: string | null) => {
    if (!dob) return null
    const d = new Date(dob)
    if (Number.isNaN(d.getTime())) return dob
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  }

  const handleMerge = async () => {
    if (!selectedId || !activeBranch) return
    const label = selected ? `${selected.first_name} ${selected.last_name}` : selectedId.slice(0, 8)
    if (!confirm(`Merge "${label}" into "${masterName}"? The duplicate record will be archived.`)) return

    setMerging(true)
    setError(null)
    const { error: err } = await mergePatients({
      masterId: masterPatientId,
      duplicateId: selectedId,
      reason: reason.trim() || undefined,
    })
    setMerging(false)

    if (err) {
      setError(err)
      return
    }

    setMergedLabel(label)
    setQuery("")
    setSelectedId("")
    setReason("")
    setResults([])
    onMerged?.()
  }

  if (mergedLabel) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="flex items-start gap-3 py-6">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-emerald-900">
              Merged {mergedLabel} into {masterName}.
            </p>
            <p className="text-xs text-emerald-800">
              The duplicate profile is archived. Review clinical records on both charts if needed.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMergedLabel(null)}
            >
              Merge another duplicate
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-amber-900">
          <GitMerge className="h-4 w-4" />
          Merge duplicate patient
        </CardTitle>
        <CardDescription>
          Admin only. Archives the duplicate record and links it to this master profile ({masterName}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeBranch ? (
          <p className="text-sm text-neutral-600 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            Select an active branch before searching for duplicates.
          </p>
        ) : null}

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Merging cannot be undone from the UI. Appointments and billing on the duplicate stay on the
            archived record until manually reconciled.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-900">Search duplicate patient</label>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedId("")
            }}
            placeholder="Name or phone"
            disabled={!activeBranch}
          />
        </div>

        {searching && query.trim().length >= 2 ? (
          <p className="text-xs text-neutral-500">Searching…</p>
        ) : null}

        {!searching && query.trim().length >= 2 && results.length === 0 && activeBranch ? (
          <p className="text-sm text-neutral-500 rounded-md border border-dashed border-neutral-200 px-3 py-2">
            No other patients match this search in {activeBranch.name}.
          </p>
        ) : null}

        {results.length > 0 && (
          <ul className="border rounded-md divide-y text-sm max-h-40 overflow-y-auto">
            {results.map((p) => {
              const dob = formatDob(p.date_of_birth)
              const archived = p.status === "archived"
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => !archived && setSelectedId(p.id)}
                    disabled={archived}
                    className={`w-full text-left px-3 py-2 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 ${
                      selectedId === p.id ? "bg-primary-50 text-primary-800" : ""
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span>
                        {p.first_name} {p.last_name}
                        {p.phone ? ` · ${p.phone}` : ""}
                        {dob ? ` · ${dob}` : ""}
                      </span>
                      {archived ? (
                        <Badge variant="outline" className="text-[10px]">
                          Archived
                        </Badge>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {selected ? (
          <div className="rounded-md border border-neutral-200 bg-neutral-50/80 px-3 py-3 text-sm space-y-1">
            <p className="font-medium text-neutral-900">Merge preview</p>
            <p className="text-neutral-600">
              Duplicate:{" "}
              <Link href={`/patients/${selected.id}`} className="text-primary-600 hover:underline">
                {selected.first_name} {selected.last_name}
              </Link>
              {selected.phone ? ` (${selected.phone})` : ""}
            </p>
            <p className="text-neutral-600">
              Into master: <span className="font-medium text-neutral-900">{masterName}</span>
            </p>
            <p className="text-xs text-neutral-500">
              The duplicate profile will be archived and linked to the master record.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-900">Reason (optional)</label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Duplicate registration, same person"
            disabled={!activeBranch}
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button
          type="button"
          variant="destructive"
          disabled={!selectedId || merging || !activeBranch}
          onClick={handleMerge}
          className="gap-2"
        >
          <GitMerge className="h-4 w-4" />
          {merging ? "Merging…" : "Merge into this patient"}
        </Button>
      </CardContent>
    </Card>
  )
}
