"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { History, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
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

function listPreview(items: string[]): string {
  if (items.length === 0) return "—"
  return items.join(", ")
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
  const { t, locale } = useLocale()
  const [selectedVersion, setSelectedVersion] = React.useState<number | null>(null)
  const [compareA, setCompareA] = React.useState<number | "">("")
  const [compareB, setCompareB] = React.useState<number | "">("")

  const dateLocale = locale === "tr" ? "tr-TR" : locale === "fil" ? "fil-PH" : "en-PH"

  React.useEffect(() => {
    if (!open) return
    const latest = versions[0]?.version ?? null
    const previous = versions[1]?.version ?? null
    const id = window.setTimeout(() => {
      setSelectedVersion(latest)
      setCompareA(previous ?? "")
      setCompareB(latest ?? "")
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, versions])

  React.useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  const selected = versions.find((v) => v.version === selectedVersion) ?? versions[0] ?? null
  const recordA = versions.find((v) => v.version === compareA)
  const recordB = versions.find((v) => v.version === compareB)

  const diffs =
    recordA && recordB
      ? [
          diffField(t("medicalHistory.allergies", "Allergies"), recordA.allergies, recordB.allergies),
          diffField(
            t("medicalHistory.medications", "Medications"),
            recordA.medications,
            recordB.medications
          ),
          diffField(
            t("medicalHistory.conditions", "Conditions"),
            recordA.conditions,
            recordB.conditions
          ),
        ]
      : []

  const notesChanged =
    recordA && recordB && (recordA.notes ?? "") !== (recordB.notes ?? "")

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mh-version-history-title"
      style={{ viewTransitionName: "none" }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label={t("common.close", "Close")}
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 shrink-0 text-primary-600" />
              <h2
                id="mh-version-history-title"
                className="text-base font-semibold text-neutral-900"
              >
                {t("medicalHistory.versionHistoryTitle", "Version history")}
              </h2>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {t("medicalHistory.versionHistoryCount", "{count} saved record(s)").replace(
                "{count}",
                String(versions.length)
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {versions.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              {t("medicalHistory.noVersions", "No versions yet.")}
            </p>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {t("medicalHistory.allVersions", "All versions")}
                </h3>
                <ul className="space-y-2">
                  {versions.map((v) => {
                    const isSelected = selected?.version === v.version
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedVersion(v.version)}
                          className={
                            isSelected
                              ? "flex w-full items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50/60 px-3 py-2.5 text-left"
                              : "flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 text-left hover:bg-neutral-50"
                          }
                        >
                          <span className="text-sm font-semibold text-neutral-900">
                            v{v.version}
                            {v.version === versions[0]?.version ? (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                {t("medicalHistory.latest", "Latest")}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs text-neutral-500">
                            {new Date(v.created_at).toLocaleString(dateLocale, {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Asia/Manila",
                            })}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {selected ? (
                <section className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {t("medicalHistory.versionDetail", "Version {n} details").replace(
                      "{n}",
                      String(selected.version)
                    )}
                  </h3>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-neutral-500">
                        {t("medicalHistory.allergies", "Allergies")}
                      </dt>
                      <dd className="mt-0.5 text-neutral-800">{listPreview(selected.allergies)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-500">
                        {t("medicalHistory.medications", "Medications")}
                      </dt>
                      <dd className="mt-0.5 text-neutral-800">{listPreview(selected.medications)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-500">
                        {t("medicalHistory.conditions", "Conditions")}
                      </dt>
                      <dd className="mt-0.5 text-neutral-800">{listPreview(selected.conditions)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-500">
                        {t("medicalHistory.notes", "Notes")}
                      </dt>
                      <dd className="mt-0.5 text-neutral-800">{selected.notes?.trim() || "—"}</dd>
                    </div>
                  </dl>
                </section>
              ) : null}

              {versions.length >= 2 ? (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {t("medicalHistory.compareVersions", "Compare versions")}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {t(
                        "medicalHistory.compareHint",
                        "See what changed between two snapshots."
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-neutral-600">
                        {t("medicalHistory.compareFrom", "From")}
                      </label>
                      <select
                        value={compareA}
                        onChange={(e) => setCompareA(Number(e.target.value))}
                        className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-2.5 text-sm"
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.version}>
                            v{v.version}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-neutral-600">
                        {t("medicalHistory.compareTo", "To")}
                      </label>
                      <select
                        value={compareB}
                        onChange={(e) => setCompareB(Number(e.target.value))}
                        className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-2.5 text-sm"
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.version}>
                            v{v.version}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {recordA && recordB && compareA === compareB ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {t(
                        "medicalHistory.compareSame",
                        "Select two different versions to compare."
                      )}
                    </p>
                  ) : null}

                  {recordA && recordB && compareA !== compareB ? (
                    <div className="space-y-3">
                      {diffs.map((d) => (
                        <div
                          key={d.label}
                          className="rounded-xl border border-neutral-200 bg-white px-3 py-3"
                        >
                          <p className="text-sm font-medium text-neutral-900">{d.label}</p>
                          {d.added.length === 0 && d.removed.length === 0 ? (
                            <p className="mt-2 text-xs text-neutral-500">
                              {t("medicalHistory.noChanges", "No changes")}
                            </p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-1.5">
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
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3">
                        <p className="text-sm font-medium text-neutral-900">
                          {t("medicalHistory.notes", "Notes")}
                        </p>
                        {notesChanged ? (
                          <div className="mt-2 space-y-2 text-xs leading-relaxed">
                            <p className="rounded-md bg-red-50 px-2 py-1.5 text-red-800 line-through">
                              {recordA.notes || "—"}
                            </p>
                            <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-800">
                              {recordB.notes || "—"}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-neutral-500">
                            {t("medicalHistory.noChanges", "No changes")}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  )
}
