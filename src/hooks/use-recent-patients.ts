"use client"
import * as React from "react"

const STORAGE_KEY = "dentql:recent-patients"
const MAX = 5

export interface RecentPatient {
  id: string
  name: string
  visitedAt: number // timestamp
}

export function useRecentPatients() {
  const [recent, setRecent] = React.useState<RecentPatient[]>(() => {
    if (typeof window === "undefined") return []
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as RecentPatient[]
    } catch {
      return []
    }
  })

  const addRecent = React.useCallback((patient: Omit<RecentPatient, "visitedAt">) => {
    setRecent((prev) => {
      const filtered = prev.filter((p) => p.id !== patient.id)
      const next = [{ ...patient, visitedAt: Date.now() }, ...filtered].slice(0, MAX)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { recent, addRecent }
}
