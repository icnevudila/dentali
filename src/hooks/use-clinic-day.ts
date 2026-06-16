"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { addDaysToKey, parseDateKey, toDateKey } from "@/lib/appointments/week-calendar"

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function useClinicDay() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = React.useMemo(() => toDateKey(new Date()), [])

  const dateParam = searchParams.get("date")
  const clinicDay =
    dateParam && DATE_KEY_RE.test(dateParam) ? dateParam : today

  const isToday = clinicDay === today
  const previousDay = addDaysToKey(clinicDay, -1)
  const nextDay = addDaysToKey(clinicDay, 1)
  const canGoForward = clinicDay < today

  const setClinicDay = React.useCallback(
    (dateKey: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (dateKey === today) params.delete("date")
      else params.set("date", dateKey)
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : "?", { scroll: false })
    },
    [router, searchParams, today]
  )

  const goToday = React.useCallback(() => setClinicDay(today), [setClinicDay, today])
  const goYesterday = React.useCallback(
    () => setClinicDay(addDaysToKey(today, -1)),
    [setClinicDay, today]
  )
  const shiftDay = React.useCallback(
    (delta: number) => {
      const next = addDaysToKey(clinicDay, delta)
      if (next > today) return
      setClinicDay(next)
    },
    [clinicDay, setClinicDay, today]
  )

  const formattedDay = React.useMemo(
    () =>
      parseDateKey(clinicDay).toLocaleDateString("en-PH", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      }),
    [clinicDay]
  )

  return {
    clinicDay,
    today,
    previousDay,
    nextDay,
    isToday,
    canGoForward,
    formattedDay,
    setClinicDay,
    goToday,
    goYesterday,
    shiftDay,
  }
}
