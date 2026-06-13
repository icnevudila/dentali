"use client"

import { useCallback } from "react"
import { useAuth } from "./use-auth"
import { usePermissionStore } from "@/stores/permission-store"

export function usePermission() {
  const { user, loading: authLoading } = useAuth()
  const { loading, hasPermission: storeHas } = usePermissionStore()

  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (!user) return false
      return storeHas(permissionKey)
    },
    [user, storeHas]
  )

  return { hasPermission, loading: authLoading || loading }
}
