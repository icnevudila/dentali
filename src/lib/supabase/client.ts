import { createBrowserClient } from "@supabase/ssr"

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Return a dummy proxy object so static prerendering doesn't crash during build
    return new Proxy({} as any, {
      get(_, prop) {
        if (prop === "auth") {
          return {
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signOut: async () => ({ error: null }),
            signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
          }
        }
        return () => ({ data: null, error: null })
      },
    })
  }

  if (typeof window === "undefined") {
    return createBrowserClient(url, key, {
      auth: {
        persistSession: true,
        storage: undefined,
      },
    })
  }

  if (!browserClient) {
    let safeStorage: any = undefined
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem("sb-test", "test")
        window.sessionStorage.removeItem("sb-test")
        safeStorage = window.sessionStorage
      }
    } catch {
      // sessionStorage is blocked (e.g. Opera/Safari private mode or security settings)
      safeStorage = undefined
    }

    browserClient = createBrowserClient(url, key, {
      auth: {
        persistSession: true,
        storage: safeStorage,
      },
    })
  }

  return browserClient
}
