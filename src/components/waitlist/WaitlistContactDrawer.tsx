"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import {
  fetchContactAttempts,
  markWaitlistContacted,
  type ContactAttempt,
  type ContactOutcome,
  type WaitlistEntry,
} from "@/lib/waitlist/waitlist-service"

interface WaitlistContactDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: WaitlistEntry | null
  onCreated: () => void
}

function formatRelativeTime(dateString: string) {
  try {
    const date = new Date(dateString)
    const diffMs = new Date().getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return "yesterday"
    return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" })
  } catch {
    return dateString
  }
}

export function WaitlistContactDrawer({
  open,
  onOpenChange,
  entry,
  onCreated,
}: WaitlistContactDrawerProps) {
  const { t } = useLocale()
  const [contactOutcome, setContactOutcome] = React.useState<ContactOutcome>("reached")
  const [contactNote, setContactNote] = React.useState("")
  const [contactHistory, setContactHistory] = React.useState<ContactAttempt[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch history when entry changes
  React.useEffect(() => {
    if (!open || !entry) {
      setContactHistory([])
      return
    }
    fetchContactAttempts(entry.id).then(({ data }) => setContactHistory(data))
  }, [open, entry])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry) return
    setSaving(true)
    setError(null)

    // Parameter order: entryId, note, outcome
    const { error: err } = await markWaitlistContacted(entry.id, contactNote.trim(), contactOutcome)
    setSaving(false)
    if (err) {
      setError(err)
    } else {
      onOpenChange(false)
      onCreated()
    }
  }

  if (!open || !entry) return null

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("common.close", "Close")}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer panel */}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {t("waitlist.contactTitle", "Contact")} - {entry.patient_name}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {t("waitlist.previousAttempts", "Previous attempts and outcome log")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* History attempts list */}
          {contactHistory.length > 0 ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {t("waitlist.callHistory", "Call history")}
              </label>
              <ul className="divide-y rounded-xl border border-neutral-100 bg-neutral-50/50 p-2 text-sm">
                {contactHistory.map((attempt) => (
                  <li key={attempt.id} className="py-2 first:pt-1 last:pb-1 px-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-neutral-800 animate-fade-in">
                        {attempt.outcome}
                      </span>
                      <time className="text-neutral-400">
                        {attempt.created_at ? formatRelativeTime(attempt.created_at) : ""}
                      </time>
                    </div>
                    {attempt.note && (
                      <p className="mt-1 text-xs text-neutral-500 italic">“{attempt.note}”</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-center text-xs text-neutral-400">
              No previous contact attempts recorded.
            </div>
          )}

          {/* Form */}
          <form id="waitlist-contact-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Outcome Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("waitlist.outcome", "Outcome")} *
              </label>
              <select
                className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                value={contactOutcome}
                onChange={(e) => setContactOutcome(e.target.value as ContactOutcome)}
              >
                <option value="reached">{t("waitlist.reached", "Reached & interested")}</option>
                <option value="no_answer">{t("waitlist.noAnswer", "No answer")}</option>
                <option value="voicemail">{t("waitlist.voicemail", "Voicemail")}</option>
                <option value="declined">{t("waitlist.declined", "Declined / Not interested")}</option>
                <option value="other">{t("waitlist.otherOutcome", "Other")}</option>
              </select>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                {t("waitlist.contactNote", "Contact notes")}
              </label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={t("waitlist.notesPlaceholder", "e.g. Left a voicemail, will call back tomorrow...")}
                value={contactNote}
                onChange={(e) => setContactNote(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t bg-neutral-50/60 px-6 py-4">
          <div className="flex gap-3">
            <Button
              type="submit"
              form="waitlist-contact-form"
              disabled={saving}
              className="flex-1"
            >
              {saving
                ? t("common.saving", "Saving…")
                : t("waitlist.logAttempt", "Log attempt")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
