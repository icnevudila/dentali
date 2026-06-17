"use client"

import * as React from "react"
import {
  OPERATIONAL_REFRESH_EVENT,
  type OperationalRefreshDetail,
} from "@/lib/operational/operational-events"

type OperationalRefreshOptions = {
  debounceMs?: number
}

/** Listen for cross-page operational refresh signals (from global realtime provider). */
export function useOperationalRefresh(
  tables: string[],
  onRefresh: () => void,
  options: OperationalRefreshOptions = {}
) {
  const tablesKey = tables.join(",")
  const debounceMs = options.debounceMs ?? 500

  React.useEffect(() => {
    let timer: number | null = null
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OperationalRefreshDetail>).detail
      if (!detail?.tables?.some((table) => tables.includes(table))) return
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        onRefresh()
      }, debounceMs)
    }
    window.addEventListener(OPERATIONAL_REFRESH_EVENT, handler)
    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener(OPERATIONAL_REFRESH_EVENT, handler)
    }
  }, [tablesKey, tables, onRefresh, debounceMs])
}
