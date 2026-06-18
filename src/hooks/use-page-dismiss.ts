"use client"

import * as React from "react"

const storagePrefix = "dismiss:"

function readDismissed(key: string | undefined): boolean {
  if (!key || typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(`${storagePrefix}${key}`) === "1"
  } catch {
    return false
  }
}

/** Persist "don't show again" for module guides and optional chrome. */
export function usePageDismiss(key: string | undefined) {
  const [dismissed, setDismissed] = React.useState(() => readDismissed(key))

  const dismiss = React.useCallback(() => {
    if (!key) return
    try {
      window.localStorage.setItem(`${storagePrefix}${key}`, "1")
    } catch {
      // private browsing / quota
    }
    setDismissed(true)
  }, [key])

  const reset = React.useCallback(() => {
    if (!key) return
    try {
      window.localStorage.removeItem(`${storagePrefix}${key}`)
    } catch {
      // ignore
    }
    setDismissed(false)
  }, [key])

  return { dismissed, dismiss, reset }
}
