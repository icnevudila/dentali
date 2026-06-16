"use client"

import { Copy, FileText, ListChecks, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CarryForwardNote, CarryForwardPlan } from "@/lib/clinical/encounter-carry-forward"

type PickerActions = {
  onCopy: () => void
  onBlank: () => void
  onDismiss?: () => void
  loading?: boolean
}

function NoteCarryForwardPicker({
  source,
  onCopy,
  onBlank,
  onDismiss,
  loading,
}: { source: CarryForwardNote } & PickerActions) {
  return (
    <Card className="border-primary-200 bg-primary-50/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-600" />
              Copy from previous visit?
            </CardTitle>
            <CardDescription>
              Source: {source.sourceLabel} · {source.title}
            </CardDescription>
          </div>
          {onDismiss ? (
            <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-primary-100 bg-white/80 p-3 text-sm text-neutral-700 space-y-2 max-h-40 overflow-y-auto">
          {source.subjective ? (
            <p>
              <span className="font-medium text-neutral-500">S: </span>
              {source.subjective}
            </p>
          ) : null}
          {source.objective ? (
            <p>
              <span className="font-medium text-neutral-500">O: </span>
              {source.objective}
            </p>
          ) : null}
          {source.assessment ? (
            <p>
              <span className="font-medium text-neutral-500">A: </span>
              {source.assessment}
            </p>
          ) : null}
          {source.plan ? (
            <p>
              <span className="font-medium text-neutral-500">P: </span>
              {source.plan}
            </p>
          ) : null}
          {!source.subjective && !source.objective && !source.assessment && !source.plan ? (
            <p className="text-neutral-500">Previous note has no SOAP content to copy.</p>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" onClick={onCopy} disabled={loading} className="gap-2">
            <Copy className="h-4 w-4" />
            {loading ? "Copying…" : "Copy from last visit"}
          </Button>
          <Button type="button" variant="outline" onClick={onBlank} disabled={loading}>
            Start blank
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PlanCarryForwardPicker({
  source,
  onCopy,
  onBlank,
  onDismiss,
  loading,
}: { source: CarryForwardPlan } & PickerActions) {
  return (
    <Card className="border-primary-200 bg-primary-50/40">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary-600" />
              Copy from previous visit?
            </CardTitle>
            <CardDescription>
              Source: {source.sourceLabel} · {source.title} ({source.itemCount} items)
            </CardDescription>
          </div>
          {onDismiss ? (
            <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-neutral-600">
          Duplicate {source.itemCount} procedure line(s) from the last plan into a new proposed plan for this visit.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" onClick={onCopy} disabled={loading} className="gap-2">
            <Copy className="h-4 w-4" />
            {loading ? "Copying…" : "Copy from last visit"}
          </Button>
          <Button type="button" variant="outline" onClick={onBlank} disabled={loading}>
            Start blank
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

type NotePickerProps = { kind: "note"; source: CarryForwardNote } & PickerActions
type PlanPickerProps = { kind: "plan"; source: CarryForwardPlan } & PickerActions

export function EncounterCarryForwardPicker(props: NotePickerProps | PlanPickerProps) {
  if (props.kind === "note") {
    return <NoteCarryForwardPicker {...props} />
  }
  return <PlanCarryForwardPicker {...props} />
}
