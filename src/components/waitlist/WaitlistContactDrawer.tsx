"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Phone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

function formatRelativeTime(dateString: string, locale: string) {
  try {
    const date = new Date(dateString)
    const diffMs = Date.now() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return "yesterday"
    return date.toLocaleDateString(locale, { month: "short", day: "numeric" })
  } catch {
    return dateString
  }
}

function outcomeLabel(outcome: string, t: (key: string, fallback: string) => string): string {
  switch (outcome) {
    case "reached":
      return t("waitlist.reached", "Reached & interested")
    case "no_answer":
      return t("waitlist.noAnswer", "No answer")
    case "voicemail":
      return t("waitlist.voicemail", "Voicemail")
    case "declined":
      return t("waitlist.declined", "Declined / Not interested")
    case "other":
      return t("waitlist.otherOutcome", "Other")
    default:
      return outcome
  }
}

export function WaitlistContactDrawer({
  open,
  onOpenChange,
  entry,
  onCreated,
}: WaitlistContactDrawerProps) {
  const { t, locale } = useLocale()
  const [contactOutcome, setContactOutcome] = React.useState<ContactOutcome>("reached")
  const [contactNote, setContactNote] = React.useState("")
  const [contactHistory, setContactHistory] = React.useState<ContactAttempt[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const dateLocale = locale === "tr" ? "tr-TR" : locale === "fil" ? "fil-PH" : "en-PH"
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

  React.useEffect(() => {
    if (!open || !entry) {
      setContactHistory([])
      return
    }
    const id = window.setTimeout(() => {
      setContactOutcome("reached")
      setContactNote("")
      setError(null)
    }, 0)
    fetchContactAttempts(entry.id).then(({ data }) => setContactHistory(data))
    return () => window.clearTimeout(id)
  }, [open, entry])

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry) return
    setSaving(true)
    setError(null)

    const { error: err } = await markWaitlistContacted(entry.id, contactNote.trim(), contactOutcome)
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    close()
    onCreated()
  }

  if (!open || !entry || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-contact-title"
      style={{ viewTransitionName: "none" }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label={t("common.close", "Close")}
        onClick={close}
      />

      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-primary-600" />
              <h2
                id="waitlist-contact-title"
                className="truncate text-base font-semibold text-neutral-900"
              >
                {t("waitlist.contactTitle", "Contact")} · {entry.patient_name}
              </h2>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {t("waitlist.contactSubtitle", "Log each call attempt and outcome for the waitlist.")}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {t("waitlist.previousAttempts", "Previous attempts")}
              </h3>
              {contactHistory.length > 0 ? (
                <Badge variant="outline" className="text-[10px]">
                  {contactHistory.length}
                </Badge>
              ) : null}
            </div>

            {contactHistory.length > 0 ? (
              <ul className="space-y-2">
                {contactHistory.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-neutral-900">
                        {outcomeLabel(attempt.outcome, t)}
                      </p>
                      <time className="shrink-0 text-xs text-neutral-500">
                        {attempt.created_at
                          ? formatRelativeTime(attempt.created_at, dateLocale)
                          : ""}
                      </time>
                    </div>
                    {attempt.note ? (
                      <p className="mt-1.5 text-sm leading-5 text-neutral-600">{attempt.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center">
                <p className="text-sm text-neutral-500">
                  {t(
                    "waitlist.noPreviousAttempts",
                    "No previous contact attempts recorded."
                  )}
                </p>
              </div>
            )}
          </section>

          <section className="space-y-4 border-t border-neutral-100 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {t("waitlist.newAttempt", "New attempt")}
            </h3>
            <form id="waitlist-contact-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="waitlist-contact-outcome"
                  className="block text-sm font-medium text-neutral-700"
                >
                  {t("waitlist.outcome", "Outcome")}{" "}
                  <span className="text-red-600" aria-hidden>
                    *
                  </span>
                </label>
                <select
                  id="waitlist-contact-outcome"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  value={contactOutcome}
                  onChange={(e) => setContactOutcome(e.target.value as ContactOutcome)}
                >
                  <option value="reached">{t("waitlist.reached", "Reached & interested")}</option>
                  <option value="no_answer">{t("waitlist.noAnswer", "No answer")}</option>
                  <option value="voicemail">{t("waitlist.voicemail", "Voicemail")}</option>
                  <option value="declined">
                    {t("waitlist.declined", "Declined / Not interested")}
                  </option>
                  <option value="other">{t("waitlist.otherOutcome", "Other")}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="waitlist-contact-note"
                  className="block text-sm font-medium text-neutral-700"
                >
                  {t("waitlist.contactNote", "Contact notes")}
                </label>
                <textarea
                  id="waitlist-contact-note"
                  className="w-full min-h-[120px] rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={t(
                    "waitlist.notesPlaceholder",
                    "e.g. Left a voicemail, will call back tomorrow…"
                  )}
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </form>
          </section>
        </div>

        <div className="shrink-0 border-t border-neutral-100 bg-neutral-50 px-5 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="sm:min-w-[7rem]" onClick={close}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              form="waitlist-contact-form"
              disabled={saving}
              className="sm:min-w-[10rem]"
            >
              {saving ? t("common.saving", "Saving…") : t("waitlist.logAttempt", "Log attempt")}
            </Button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
