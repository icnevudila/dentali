"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import {
  fetchPublicQueueDisplay,
  recordDisplayHeartbeat,
  type PublicQueueDisplay,
} from "@/lib/display/display-service"
import { QueueDisplayBoard, type QueueDisplayTheme } from "@/components/display/QueueDisplayBoard"
import { useQueueVoiceAnnounce } from "@/lib/display/use-queue-voice-announce"
import { createClient } from "@/lib/supabase/client"
import { useLocale } from "@/hooks/use-locale"

function useLiveClock(intervalMs = 1000) {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function parseDisplayTheme(value: string | null): QueueDisplayTheme {
  return value === "dark" ? "dark" : "light"
}

function parseDisplayFlag(value: string | null, defaultOn = true): boolean {
  if (value === "0" || value === "false") return false
  if (value === "1" || value === "true") return true
  return defaultOn
}

const VOICE_PREF_KEY = "dentali-display-voice"

function DisplayContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const theme = parseDisplayTheme(searchParams.get("theme"))
  const showNames = parseDisplayFlag(searchParams.get("names"), true)
  const voiceFromUrl = parseDisplayFlag(searchParams.get("voice"), true)
  const { t, locale } = useLocale()
  const liveNow = useLiveClock()

  const [voiceEnabled, setVoiceEnabled] = React.useState(voiceFromUrl)

  const [liveConnected, setLiveConnected] = React.useState(false)
  const [lastSyncAt, setLastSyncAt] = React.useState<number | null>(null)
  const [online, setOnline] = React.useState(true)

  const [data, setData] = React.useState<PublicQueueDisplay | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [reconnecting, setReconnecting] = React.useState(false)
  const [branchId, setBranchId] = React.useState<string | null>(null)
  const [pulseGen, setPulseGen] = React.useState(0)
  const prevServingRef = React.useRef<string>("")

  const load = React.useCallback(
    (silent = false) => {
      if (!token) {
        setError(t("display.invalidLink", "Invalid display link. Please contact the front desk."))
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      else setReconnecting(true)

      fetchPublicQueueDisplay(token).then(({ data: d, error: err }) => {
        if (err) setError(err)
        else {
          const servingKey = (d?.now_serving ?? [])
            .map((i) => `${i.display_code}_${i.called_at ?? ""}`)
            .join("|")
          if (servingKey && servingKey !== prevServingRef.current) {
            setPulseGen((g) => g + 1)
            prevServingRef.current = servingKey
          }
          setData(d)
          if (d?.branch_id) setBranchId(d.branch_id)
          setError(null)
          setLastSyncAt(Date.now())
          void recordDisplayHeartbeat(token)
        }
        setLoading(false)
        setReconnecting(false)
      })
    },
    [token, t]
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.sessionStorage.getItem(VOICE_PREF_KEY)
    if (stored === "0") setVoiceEnabled(false)
    else if (stored === "1") setVoiceEnabled(true)
    else setVoiceEnabled(voiceFromUrl)
  }, [voiceFromUrl])

  const toggleVoice = React.useCallback(() => {
    setVoiceEnabled((on) => {
      const next = !on
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(VOICE_PREF_KEY, next ? "1" : "0")
      }
      return next
    })
  }, [])

  useQueueVoiceAnnounce({
    enabled: voiceEnabled && voiceFromUrl,
    nowServing: data?.now_serving ?? [],
    locale,
    pulseGen,
    t,
  })

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (!token) return
    void recordDisplayHeartbeat(token)
    const heartbeat = setInterval(() => void recordDisplayHeartbeat(token), 60_000)
    return () => clearInterval(heartbeat)
  }, [token])

  React.useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    setOnline(navigator.onLine)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  const loadRef = React.useRef(load)
  React.useEffect(() => {
    loadRef.current = load
  }, [load])

  React.useEffect(() => {
    if (!branchId || !token) return

    const supabase = createClient()
    const channel = supabase
      .channel(`display-queue-${branchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `branch_id=eq.${branchId}`,
        },
        () => loadRef.current(true)
      )
      .subscribe((status: any) => {
        setLiveConnected(status === "SUBSCRIBED")
      })

    const interval = setInterval(() => loadRef.current(true), 2_000)

    return () => {
      clearInterval(interval)
      setLiveConnected(false)
      supabase.removeChannel(channel)
    }
  }, [branchId, token])

  const syncAgeSec =
    lastSyncAt != null ? Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000)) : null

  if (loading) {
    return (
      <div
        className={
          theme === "light"
            ? "flex min-h-screen items-center justify-center bg-neutral-50"
            : "flex min-h-screen items-center justify-center bg-neutral-950"
        }
      >
        <Loader2
          className={
            theme === "light"
              ? "h-16 w-16 animate-spin text-primary-600"
              : "h-16 w-16 animate-spin text-primary-400"
          }
        />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={
          theme === "light"
            ? "flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-8 text-center text-neutral-900"
            : "flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-8 text-center text-white"
        }
      >
        <AlertCircle className="mb-6 h-20 w-20 text-amber-500" />
        <h1 className="mb-4 text-4xl font-bold">
          {t("display.checkFrontDesk", "Please check with the front desk")}
        </h1>
        <p className={theme === "light" ? "max-w-md text-xl text-neutral-600" : "max-w-md text-xl text-neutral-400"}>
          {error}
        </p>
      </div>
    )
  }

  return (
    <QueueDisplayBoard
      branchName={data?.branch_name ?? ""}
      nowServing={data?.now_serving ?? []}
      waiting={data?.waiting ?? []}
      theme={theme}
      clock={liveNow}
      updatedAt={data?.updated_at ?? null}
      syncAgeSec={syncAgeSec}
      pulseGen={pulseGen}
      showNames={showNames}
      voiceEnabled={voiceEnabled && voiceFromUrl}
      onVoiceToggle={voiceFromUrl ? toggleVoice : undefined}
      connection={{
        online,
        live: liveConnected,
        reconnecting,
      }}
    />
  )
}

export default function DisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50">
          <Loader2 className="h-16 w-16 animate-spin text-primary-600" />
        </div>
      }
    >
      <DisplayContent />
    </Suspense>
  )
}
