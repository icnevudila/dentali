"use client"

import { useBranch } from "@/hooks/use-branch"
import { useOperationalRealtime } from "@/hooks/use-operational-realtime"

/** Mount once in dashboard layout — global operational toasts + refresh signals. */
export function OperationalRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { activeBranch } = useBranch()
  useOperationalRealtime(activeBranch?.id)
  return <>{children}</>
}
