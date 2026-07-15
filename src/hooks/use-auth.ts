"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User, Session } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

function sameUser(a: User | null, b: User | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.id === b.id
}

function sameAccessToken(a: Session | null, b: Session | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.access_token === b.access_token
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const userRef = useRef<User | null>(null)
  const sessionRef = useRef<Session | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const applySession = (next: Session | null) => {
      const nextUser = next?.user ?? null
      if (!sameUser(userRef.current, nextUser)) {
        userRef.current = nextUser
        setUser(nextUser)
      }
      if (!sameAccessToken(sessionRef.current, next)) {
        sessionRef.current = next
        setSession(next)
      }
      setLoading(false)
    }

    void supabase.auth.getSession().then(({ data: { session: current } }) => {
      applySession(current)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Ignore no-op TOKEN_REFRESHED churn that would remount PermissionGates.
      applySession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    userRef.current = null
    sessionRef.current = null
    setUser(null)
    setSession(null)
    router.push("/login")
  }

  return { user, session, loading, signOut }
}
