"use client"

import * as React from "react"
import { useBranch } from "@/hooks/use-branch"
import {
  fetchBranchContext,
  type BranchContext,
} from "@/lib/org/branch-context-service"

export function useBranchContext() {
  const { activeBranch } = useBranch()
  const [context, setContext] = React.useState<BranchContext | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!activeBranch?.id) {
      setContext(null)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchBranchContext(activeBranch.id).then(({ data, error: err }) => {
      if (cancelled) return
      setContext(data)
      setError(err)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [activeBranch?.id])

  return {
    branchContext: context,
    loading,
    error,
    timezone: context?.timezone ?? "Asia/Manila",
    currencyCode: context?.currency_code ?? "PHP",
  }
}
