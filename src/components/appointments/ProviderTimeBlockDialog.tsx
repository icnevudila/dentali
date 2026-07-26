"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { CalendarOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { StaffMember } from "@/lib/staff/staff-service"
import {
  createProviderTimeBlock,
  deleteProviderTimeBlock,
  fetchProviderTimeBlocks,
  type ProviderTimeBlock,
} from "@/lib/appointments/provider-time-blocks-service"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  providers: StaffMember[]
  selectedDate: string
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ProviderTimeBlockDialog({
  open,
  onOpenChange,
  branchId,
  providers,
  selectedDate,
}: Props) {
  const { t } = useLocale()
  const [mounted, setMounted] = React.useState(false)
  const [blocks, setBlocks] = React.useState<ProviderTimeBlock[]>([])
  const [loading, setLoading] = React.useState(false)
  const [providerId, setProviderId] = React.useState("")
  const [startsAt, setStartsAt] = React.useState(`${selectedDate}T12:00`)
  const [endsAt, setEndsAt] = React.useState(`${selectedDate}T13:00`)
  const [reason, setReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    const dayStart = new Date(`${selectedDate}T00:00:00+08:00`).toISOString()
    const dayEnd = new Date(`${selectedDate}T23:59:59+08:00`).toISOString()
    const { data, error } = await fetchProviderTimeBlocks(branchId, dayStart, dayEnd)
    if (error) toast.error(error)
    setBlocks(data)
    setLoading(false)
  }, [branchId, selectedDate])

  React.useEffect(() => {
    if (!open) return
    setStartsAt(`${selectedDate}T12:00`)
    setEndsAt(`${selectedDate}T13:00`)
    if (!providerId && providers[0]?.profile_id) {
      setProviderId(providers[0].profile_id)
    }
    void load()
  }, [open, selectedDate, load, providers, providerId])

  const handleCreate = async () => {
    if (!providerId) {
      toast.error(t("appointments.blockNeedProvider", "Select a dentist"))
      return
    }
    setSaving(true)
    const { error } = await createProviderTimeBlock({
      branchId,
      providerId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      reason,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(t("appointments.blockCreated", "Time block created"))
    setReason("")
    await load()
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteProviderTimeBlock(id)
    if (error) toast.error(error)
    else {
      toast.success(t("appointments.blockDeleted", "Time block removed"))
      await load()
    }
  }

  const providerName = (id: string) =>
    providers.find((p) => p.profile_id === id)?.full_name ??
    providers.find((p) => p.profile_id === id)?.email ??
    id.slice(0, 8)

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close", "Close")}
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[251] flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col overflow-hidden rounded-t-[30px] border border-neutral-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-5 pb-4 pt-3 sm:px-6 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CalendarOff className="h-4 w-4" />
              {t("appointments.blockTitle", "Block provider time")}
            </h2>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {t(
              "appointments.blockDesc",
              "Mark leave, meetings, or chair downtime. Blocked slots cannot be booked."
            )}{" "}
            ({selectedDate})
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          <label className="block text-xs font-medium text-neutral-600">
            {t("appointments.dentist", "Dentist")}
            <select
              className="mt-1 h-9 w-full rounded-md border border-neutral-200 px-2 text-sm"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.profile_id} value={p.profile_id}>
                  {p.full_name ?? p.email}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-neutral-600">
              {t("appointments.starts", "Starts")}
              <input
                type="datetime-local"
                className="mt-1 h-9 w-full rounded-md border border-neutral-200 px-2 text-sm"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600">
              {t("appointments.ends", "Ends")}
              <input
                type="datetime-local"
                className="mt-1 h-9 w-full rounded-md border border-neutral-200 px-2 text-sm"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-neutral-600">
            {t("appointments.blockReason", "Reason (optional)")}
            <input
              className="mt-1 h-9 w-full rounded-md border border-neutral-200 px-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("appointments.blockReasonPh", "Meeting, leave, equipment…")}
            />
          </label>

          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-neutral-100 p-2">
            {loading ? (
              <p className="text-xs text-neutral-500">{t("common.loading", "Loading…")}</p>
            ) : blocks.length === 0 ? (
              <p className="text-xs text-neutral-500">
                {t("appointments.noBlocks", "No blocks on this day.")}
              </p>
            ) : (
              blocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-neutral-50 px-2 py-1.5 text-xs"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{providerName(b.provider_id)}</span>
                    {" · "}
                    {toLocalInputValue(b.starts_at).replace("T", " ")} →{" "}
                    {toLocalInputValue(b.ends_at).slice(11)}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-red-600"
                    onClick={() => void handleDelete(b.id)}
                  >
                    {t("common.remove", "Remove")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close", "Close")}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleCreate()}>
            {saving
              ? t("common.saving", "Saving…")
              : t("appointments.addBlock", "Add block")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
