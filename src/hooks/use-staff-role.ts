"use client"

import * as React from "react"
import { useAuth } from "@/hooks/use-auth"
import { fetchStaffProfile } from "@/lib/auth/auth-service"

/** Staff role from assignments — same source as UserAccountMenu */
export function useStaffRole() {
  const { user } = useAuth()
  const [roleName, setRoleName] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!user) {
      setRoleName(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchStaffProfile().then((staff) => {
      if (cancelled) return
      setRoleName(staff?.role_name ?? null)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  return { roleName, loading }
}
