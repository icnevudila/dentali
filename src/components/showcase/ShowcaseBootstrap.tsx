"use client"

import * as React from "react"
import type { ShowcaseSnapshot } from "@/lib/showcase/types"
import { setShowcaseSnapshot } from "@/lib/showcase/intercept"
import { useBranchStore } from "@/stores/branch-store"
import { usePermissionStore } from "@/stores/permission-store"
import { PERMISSIONS } from "@/lib/auth/permissions"

const ALL_PERMISSIONS = Object.values(PERMISSIONS)

type ShowcaseBootstrapProps = {
  snapshot: ShowcaseSnapshot
  children: React.ReactNode
  /** Fixed route params for chart showcase (e.g. patient id) */
  routeParams?: Record<string, string>
}

const ShowcaseRouteParamsContext = React.createContext<Record<string, string> | null>(null)

export function useShowcaseRouteParams<T extends Record<string, string> = Record<string, string>>() {
  const ctx = React.use(ShowcaseRouteParamsContext)
  return (ctx ?? {}) as T
}

export function ShowcaseBootstrap({ snapshot, routeParams, children }: ShowcaseBootstrapProps) {
  React.useEffect(() => {
    setShowcaseSnapshot(snapshot)
    useBranchStore.getState().setAvailableBranches([snapshot.branch])
    useBranchStore.getState().setActiveBranch(snapshot.branch)
    usePermissionStore.getState().setPermissions(ALL_PERMISSIONS, snapshot.branch.id)

    return () => {
      setShowcaseSnapshot(null)
      usePermissionStore.getState().clearPermissions()
    }
  }, [snapshot])

  return (
    <ShowcaseRouteParamsContext value={routeParams ?? null}>{children}</ShowcaseRouteParamsContext>
  )
}

export function useShowcaseSnapshot(): ShowcaseSnapshot | null {
  const [snap, setSnap] = React.useState<ShowcaseSnapshot | null>(null)
  React.useEffect(() => {
    import("@/lib/showcase/intercept").then(({ getShowcaseSnapshot }) => {
      setSnap(getShowcaseSnapshot())
    })
  }, [])
  return snap
}
