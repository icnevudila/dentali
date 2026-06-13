"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { fetchMyBranches } from "@/lib/auth/auth-service"
import { usePermissionStore } from "@/stores/permission-store"
import { fetchMyPermissions } from "@/lib/auth/auth-service"

export function BranchBootstrap({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { activeBranch, setActiveBranch, setAvailableBranches } = useBranch()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false

    fetchMyBranches().then((branches) => {
      if (cancelled) return

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

      const stillValid = activeBranch && branches.some((b) => b.id === activeBranch.id)
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
  }, [user, authLoading, setAvailableBranches, setActiveBranch, activeBranch, pathname, router])

  useEffect(() => {
    if (authLoading || !user) return

    const branchId = activeBranch?.id ?? null
    usePermissionStore.getState().setLoading(true)
    fetchMyPermissions(branchId).then((keys) => {
      usePermissionStore.getState().setPermissions(keys, branchId)
    })
  }, [user, authLoading, activeBranch?.id])

  return <>{children}</>
}
