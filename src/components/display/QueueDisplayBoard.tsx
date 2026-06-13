"use client"

import * as React from "react"
import { Activity, Radio, Volume2, VolumeX, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/hooks/use-locale"

export type QueueDisplayItem = {
  display_code: string
  masked_name?: string | null
}

export type QueueDisplayTheme = "light" | "dark"

export type QueueDisplayConnection = {
  online: boolean
  live: boolean
  reconnecting?: boolean
}

export type QueueDisplayBoardProps = {
  branchName: string
  nowServing: QueueDisplayItem[]
  waiting: QueueDisplayItem[]
  theme?: QueueDisplayTheme
  clock?: Date
  updatedAt?: string | null
  syncAgeSec?: number | null
  connection?: QueueDisplayConnection
  pulseGen?: number
  showNames?: boolean
  voiceEnabled?: boolean
  onVoiceToggle?: () => void
  className?: string
}

function ServingHero({
  code,
  maskedName,
  showNames,
  pulse,
  isNew,
  theme,
}: {
  code: string
  maskedName?: string | null
  showNames: boolean
  pulse: boolean
  isNew: boolean
  theme: QueueDisplayTheme
}) {
  const isLight = theme === "light"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] px-10 py-10 md:px-14 md:py-12 lg:px-16 lg:py-14",
        isLight
          ? "bg-gradient-to-br from-primary-600 via-primary-600 to-primary-700 text-white shadow-2xl shadow-primary-600/25 ring-1 ring-primary-500/20"
          : "bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-2xl shadow-primary-950/50",
        pulse && "animate-serve-pulse",
        isNew && "animate-serve-enter"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-30",
          isLight
            ? "bg-[radial-gradient(circle_at_30%_20%,white_0%,transparent_55%)]"
            : "bg-[radial-gradient(circle_at_30%_20%,white_0%,transparent_50%)]"
        )}
      />
      <p className="relative text-center text-xs font-semibold uppercase tracking-[0.35em] text-white/75 md:text-sm">
        Queue
      </p>
      <p className="relative mt-2 text-center font-mono text-7xl font-bold tracking-tight md:text-8xl lg:text-9xl">
        {code}
      </p>
      {showNames && maskedName ? (
        <p
          data-testid="display-masked-name"
          className="relative mt-4 text-center text-lg font-semibold tracking-wide text-white/90 md:text-xl lg:text-2xl"
        >
          {maskedName}
        </p>
      ) : null}
    </div>
  )
}

function WaitingTile({
  code,
  maskedName,
  showNames,
  position,
  isUpNext,
  theme,
}: {
  code: string
  maskedName?: string | null
  showNames: boolean
  position: number
  isUpNext: boolean
  theme: QueueDisplayTheme
}) {
  const isLight = theme === "light"

  return (
    <div
      className={cn(
        "relative flex min-w-[7.5rem] flex-col items-center rounded-2xl border px-4 py-4 md:min-w-[8.5rem] md:px-5 md:py-5",
        isUpNext
          ? isLight
            ? "border-primary-400 bg-primary-50 shadow-md shadow-primary-600/10 ring-2 ring-primary-300/60"
            : "border-primary-500/60 bg-primary-950/40 ring-2 ring-primary-500/30"
          : isLight
            ? "border-neutral-200 bg-white shadow-sm"
            : "border-neutral-800 bg-neutral-900/80"
      )}
    >
      <span
        className={cn(
          "mb-2 text-[10px] font-bold uppercase tracking-widest",
          isUpNext
            ? isLight
              ? "text-primary-700"
              : "text-primary-300"
            : isLight
              ? "text-neutral-400"
              : "text-neutral-500"
        )}
      >
        #{position}
      </span>
      <span
        className={cn(
          "font-mono text-3xl font-bold md:text-4xl",
          isUpNext
            ? isLight
              ? "text-primary-800"
              : "text-primary-100"
            : isLight
              ? "text-neutral-800"
              : "text-neutral-100"
        )}
      >
        {code}
      </span>
      {showNames && maskedName ? (
        <span
          data-testid="display-masked-name"
          className={cn(
            "mt-2 max-w-[7rem] truncate text-center text-[11px] font-semibold tracking-wide md:max-w-[8rem] md:text-xs",
            isUpNext
              ? isLight
                ? "text-primary-700"
                : "text-primary-300"
              : isLight
                ? "text-neutral-500"
                : "text-neutral-500"
          )}
        >
          {maskedName}
        </span>
      ) : null}
    </div>
  )
}

export function QueueDisplayBoard({
  branchName,
  nowServing,
  waiting,
  theme = "light",
  clock,
  updatedAt,
  syncAgeSec,
  connection,
  pulseGen = 0,
  showNames = true,
  voiceEnabled = false,
  onVoiceToggle,
  className,
}: QueueDisplayBoardProps) {
  const { t, locale } = useLocale()
  const isLight = theme === "light"
  const liveClock = clock ?? new Date()

  const dateLabel = liveClock.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  })
  const clockLabel = liveClock.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Manila",
  })

  const tickerItems = [
    t("display.proceedToCounter", "Please proceed to the front desk when your number appears"),
    t("display.tickerSilence", "Please keep your voice low in the waiting area"),
    t("display.tickerSeat", "Have a seat — we will call your queue number shortly"),
  ]

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col overflow-hidden",
        isLight
          ? "bg-gradient-to-b from-neutral-50 via-white to-primary-50/30 text-neutral-900"
          : "bg-neutral-950 text-white",
        className
      )}
    >
      {/* Ambient grid */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-[0.35]",
          isLight
            ? "[background-image:linear-gradient(to_right,rgb(20_184_166/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(20_184_166/0.06)_1px,transparent_1px)] [background-size:48px_48px]"
            : "[background-image:linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:48px_48px]"
        )}
      />

      {/* Top bar */}
      <header
        className={cn(
          "relative z-10 flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4 md:px-10 md:py-5",
          isLight ? "border-neutral-200/80 bg-white/80 backdrop-blur-md" : "border-neutral-800 bg-neutral-950/80"
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl font-bold",
              isLight ? "bg-primary-600 text-white" : "bg-primary-600 text-white"
            )}
          >
            d
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary-600">
              {t("display.clinicQueue", "Clinic queue")}
            </p>
            <p className="text-lg font-semibold md:text-xl">{branchName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          {connection ? (
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide",
                !connection.online
                  ? isLight
                    ? "bg-red-50 text-red-700"
                    : "bg-red-500/20 text-red-300"
                  : connection.reconnecting
                    ? isLight
                      ? "bg-amber-50 text-amber-800"
                      : "bg-amber-500/20 text-amber-300"
                    : connection.live
                      ? isLight
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-emerald-500/20 text-emerald-300"
                      : isLight
                        ? "bg-neutral-100 text-neutral-600"
                        : "bg-neutral-800 text-neutral-400"
              )}
            >
              {!connection.online ? (
                <WifiOff className="h-3.5 w-3.5" />
              ) : connection.reconnecting ? (
                <Activity className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <Radio
                  className={cn("h-3.5 w-3.5", connection.live && "animate-pulse")}
                />
              )}
              {!connection.online
                ? t("display.offline", "Offline")
                : connection.reconnecting
                  ? t("display.updating", "Updating…")
                  : connection.live
                    ? t("display.live", "Live")
                    : t("display.polling", "Polling")}
            </div>
          ) : null}

          <div className="text-right">
            <p className={cn("text-xs", isLight ? "text-neutral-500" : "text-neutral-400")}>
              {dateLabel}
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums md:text-2xl">{clockLabel}</p>
          </div>
        </div>
      </header>

      {/* Main board */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-8 px-6 py-8 md:px-10 md:py-10 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:py-12">
        {/* Now serving */}
        <section className="flex flex-col justify-center">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                {t("display.nowServing", "Now Serving")}
              </h1>
              <p className={cn("mt-2 text-base md:text-lg", isLight ? "text-neutral-600" : "text-neutral-400")}>
                {t("display.proceedToCounter", "Please proceed to the front desk when your number appears")}
              </p>
            </div>
            {nowServing.length > 0 ? (
              <div
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium",
                  isLight ? "bg-primary-100 text-primary-800" : "bg-primary-900/50 text-primary-200"
                )}
              >
                {t("display.beingServed", "{n} active").replace("{n}", String(nowServing.length))}
              </div>
            ) : null}
          </div>

          {nowServing.length === 0 ? (
            <div
              className={cn(
                "flex min-h-[280px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed px-8 text-center md:min-h-[360px]",
                isLight ? "border-neutral-200 bg-white/60" : "border-neutral-800 bg-neutral-900/30"
              )}
            >
              <p className={cn("text-2xl font-medium md:text-3xl", isLight ? "text-neutral-400" : "text-neutral-500")}>
                {t("display.noPatientsCalled", "No patients being called right now")}
              </p>
              <p className={cn("mt-3 max-w-md text-sm md:text-base", isLight ? "text-neutral-500" : "text-neutral-600")}>
                {t("display.queueEmptyHint", "New check-ins will appear in the waiting queue.")}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {nowServing.map((item, index) => (
                <ServingHero
                  key={`${item.display_code}-${pulseGen}`}
                  code={item.display_code}
                  maskedName={item.masked_name}
                  showNames={showNames}
                  pulse={pulseGen > 0}
                  isNew={index === 0}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </section>

        {/* Waiting queue */}
        <section
          className={cn(
            "flex flex-col rounded-[2rem] border p-6 md:p-8",
            isLight ? "border-neutral-200 bg-white shadow-xl shadow-neutral-200/40" : "border-neutral-800 bg-neutral-900/50"
          )}
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2
              className={cn(
                "text-xl font-semibold uppercase tracking-wide md:text-2xl",
                isLight ? "text-neutral-700" : "text-neutral-300"
              )}
            >
              {t("display.waiting", "Waiting")}
            </h2>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-bold tabular-nums",
                isLight ? "bg-neutral-100 text-neutral-700" : "bg-neutral-800 text-neutral-200"
              )}
            >
              {waiting.length}
            </span>
          </div>

          {waiting.length > 0 ? (
            <div
              className={cn(
                "mb-6 rounded-2xl border px-4 py-3 md:px-5 md:py-4",
                isLight
                  ? "border-primary-200 bg-primary-50/80"
                  : "border-primary-800/60 bg-primary-950/30"
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600">
                {t("display.upNext", "Up next")}
              </p>
              <p className="mt-1 font-mono text-3xl font-bold text-primary-800 md:text-4xl dark:text-primary-100">
                {waiting[0].display_code}
              </p>
              {showNames && waiting[0].masked_name ? (
                <p className="mt-1 text-sm font-semibold text-primary-700 md:text-base">
                  {waiting[0].masked_name}
                </p>
              ) : null}
            </div>
          ) : null}

          {waiting.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <p className={cn("text-lg md:text-xl", isLight ? "text-neutral-400" : "text-neutral-600")}>
                {t("display.queueEmpty", "Queue is empty")}
              </p>
            </div>
          ) : (
            <div className="flex max-h-[min(52vh,520px)] flex-wrap content-start gap-3 overflow-y-auto hide-scrollbar">
              {waiting.map((item, index) => (
                <WaitingTile
                  key={item.display_code}
                  code={item.display_code}
                  maskedName={item.masked_name}
                  showNames={showNames}
                  position={index + 1}
                  isUpNext={index === 0}
                  theme={theme}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Ticker + footer */}
      <footer
        className={cn(
          "relative z-10 mt-auto border-t",
          isLight ? "border-neutral-200 bg-white/90" : "border-neutral-800 bg-neutral-950/90"
        )}
      >
        <div className="overflow-hidden border-b border-inherit py-3">
          <div className="animate-display-ticker flex whitespace-nowrap">
            {[...tickerItems, ...tickerItems].map((text, i) => (
              <span
                key={`${i}-${text.slice(0, 12)}`}
                className={cn(
                  "mx-8 text-sm font-medium md:text-base",
                  isLight ? "text-neutral-600" : "text-neutral-400"
                )}
              >
                {text}
              </span>
            ))}
          </div>
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-xs md:px-10",
            isLight ? "text-neutral-500" : "text-neutral-600"
          )}
        >
          <p>
            {t("display.lastUpdated", "Last updated")}{" "}
            {updatedAt ? new Date(updatedAt).toLocaleTimeString(locale, { timeZone: "Asia/Manila" }) : "—"}
            {syncAgeSec != null && syncAgeSec <= 120
              ? ` · ${t("display.syncedAgo", "{n}s ago").replace("{n}", String(syncAgeSec))}`
              : null}
          </p>
          <div className="flex items-center gap-3">
            {onVoiceToggle ? (
              <button
                type="button"
                onClick={onVoiceToggle}
                data-testid="display-voice-toggle"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors",
                  isLight
                    ? voiceEnabled
                      ? "bg-primary-50 text-primary-700 hover:bg-primary-100"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    : voiceEnabled
                      ? "bg-primary-900/40 text-primary-200 hover:bg-primary-900/60"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                )}
                aria-pressed={voiceEnabled}
                aria-label={
                  voiceEnabled
                    ? t("display.voiceOn", "Voice announcements on")
                    : t("display.voiceOff", "Voice announcements off")
                }
              >
                {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                {voiceEnabled ? t("display.voiceOnShort", "Voice on") : t("display.voiceOffShort", "Voice off")}
              </button>
            ) : null}
            <p className="tracking-tight">dentali.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
