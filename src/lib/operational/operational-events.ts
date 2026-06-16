export const OPERATIONAL_REFRESH_EVENT = "operational-refresh"

export type OperationalRefreshDetail = {
  tables: string[]
}

export function dispatchOperationalRefresh(tables: string[]) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<OperationalRefreshDetail>(OPERATIONAL_REFRESH_EVENT, {
      detail: { tables },
    })
  )
}
