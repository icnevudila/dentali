"use client"

import * as React from "react"

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: PWA install remains optional in MVP
    })
  }, [])

  return null
}
