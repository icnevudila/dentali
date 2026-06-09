"use client"

import { useAuth } from './use-auth'
import { useBranch } from './use-branch'
import { useCallback } from 'react'

export function usePermission() {
  const { user } = useAuth()
  const { activeBranch } = useBranch()

  const hasPermission = useCallback((permissionKey: string) => {
    if (!user) return false
    // TODO: In Wave 1 backend integration, this will check against the user's role 
    // and the role_permissions table via Supabase JWT claims or RPC.
    return true 
  }, [user, activeBranch])

  return { hasPermission }
}
