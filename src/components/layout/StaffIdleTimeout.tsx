"use client"

import * as React from "react"
import { useAuth } from "@/hooks/use-auth"
import { useLocale } from "@/hooks/use-locale"
import { toast } from "sonner"

/** Staff dashboard idle timeout — signs out after inactivity (default 30 min). */
const IDLE_MS = 30 * 60 * 1000
const WARN_MS = 2 * 60 * 1000

export function StaffIdleTimeout() {
  const { signOut, session } = useAuth()
  const { t } = useLocale()
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef = React.useRef(false)

  const clearTimers = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (warnRef.current) clearTimeout(warnRef.current)
    timerRef.current = null
    warnRef.current = null
  }, [])

  const reset = React.useCallback(() => {
    if (!session) return
    clearTimers()
    warnedRef.current = false
    warnRef.current = setTimeout(() => {
      warnedRef.current = true
      toast.message(
        t(
          "auth.idleWarning",
          "Still there? You will be signed out in 2 minutes due to inactivity."
        )
      )
    }, IDLE_MS - WARN_MS)
    timerRef.current = setTimeout(() => {
      void signOut()
    }, IDLE_MS)
  }, [clearTimers, session, signOut, t])

  React.useEffect(() => {
    if (!session) {
      clearTimers()
      return
    }

    const windowEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ]

    const onActivity = () => {
      if (document.visibilityState === "hidden") return
      reset()
    }

    reset()
    for (const ev of windowEvents) {
      window.addEventListener(ev, onActivity, { passive: true })
    }
    document.addEventListener("visibilitychange", onActivity)
    return () => {
      clearTimers()
      for (const ev of windowEvents) {
        window.removeEventListener(ev, onActivity)
      }
      document.removeEventListener("visibilitychange", onActivity)
    }
  }, [session, reset, clearTimers])

  return null
}
