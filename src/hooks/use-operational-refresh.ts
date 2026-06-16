"use client"

import * as React from "react"
import {
  OPERATIONAL_REFRESH_EVENT,
  type OperationalRefreshDetail,
} from "@/lib/operational/operational-events"

/** Listen for cross-page operational refresh signals (from global realtime provider). */
export function useOperationalRefresh(tables: string[], onRefresh: () => void) {
  const tablesKey = tables.join(",")
  const onRefreshRef = React.useRef(onRefresh)
  onRefreshRef.current = onRefresh

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OperationalRefreshDetail>).detail
      if (!detail?.tables?.some((table) => tables.includes(table))) return
      onRefreshRef.current()
    }
    window.addEventListener(OPERATIONAL_REFRESH_EVENT, handler)
    return () => window.removeEventListener(OPERATIONAL_REFRESH_EVENT, handler)
  }, [tablesKey, tables])
}
