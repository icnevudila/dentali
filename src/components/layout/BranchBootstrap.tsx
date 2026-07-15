"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { fetchMyBranches, fetchMyPermissions } from "@/lib/auth/auth-service"
import { usePermissionStore } from "@/stores/permission-store"

export function BranchBootstrap({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { activeBranch, setActiveBranch, setAvailableBranches } = useBranch()
  const router = useRouter()
  const pathname = usePathname()
  const activeBranchId = activeBranch?.id ?? null
  const branchesFetchGen = useRef(0)
  const permissionsFetchGen = useRef(0)

  useEffect(() => {
    if (authLoading || !user) return

    const gen = ++branchesFetchGen.current
    let cancelled = false

    void fetchMyBranches().then((branches) => {
      if (cancelled || gen !== branchesFetchGen.current) return

      setAvailableBranches(
        branches.map((b) => ({
          id: b.id,
          name: b.name,
          organization_id: b.organization_id,
        }))
      )

      if (branches.length === 0) {
        if (!pathname.startsWith("/onboarding")) {
          router.replace("/onboarding")
        }
        return
      }

      if (pathname.startsWith("/onboarding")) {
        router.replace("/")
        return
      }

      const stillValid = activeBranchId && branches.some((b) => b.id === activeBranchId)
      if (!stillValid) {
        setActiveBranch({
          id: branches[0].id,
          name: branches[0].name,
          organization_id: branches[0].organization_id,
        })
      }
    })

    return () => {
      cancelled = true
    }
    // Depend on user id, not user object identity (TOKEN_REFRESHED must not reload branches).
  }, [
    user?.id,
    authLoading,
    setAvailableBranches,
    setActiveBranch,
    activeBranchId,
    pathname,
    router,
  ])

  useEffect(() => {
    if (authLoading || !user) return

    const branchId = activeBranchId
    const store = usePermissionStore.getState()
    const alreadyWarm =
      !store.loading && store.branchId === branchId && store.permissions.size > 0

    // Silent refresh when we already have perms — avoids PermissionGate skeleton remount
    // which looks like a full page refresh every auth/realtime cycle.
    if (!alreadyWarm) {
      store.setLoading(true)
    }

    const gen = ++permissionsFetchGen.current
    void fetchMyPermissions(branchId).then((keys) => {
      if (gen !== permissionsFetchGen.current) return
      usePermissionStore.getState().setPermissions(keys, branchId)
    })
  }, [user?.id, authLoading, activeBranchId])

  return <>{children}</>
}
