"use client"

import * as React from "react"
import { useBranch } from "@/hooks/use-branch"

/** Re-run effect when active branch or branchRevision changes (after switcher invalidation). */
export function useBranchScopedEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList = []
) {
  const { activeBranch, branchRevision } = useBranch()

  React.useEffect(() => {
    return effect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- branchRevision + activeBranch.id are intentional triggers
  }, [activeBranch?.id, branchRevision, ...deps])
}
