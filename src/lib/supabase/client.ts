import { createBrowserClient } from "@supabase/ssr"

let browserClient: ReturnType<typeof createBrowserClient> | null = null

/** Safe no-op Supabase client that won't throw when storage is blocked */
function createDummyClient(): any {
  const noopAsync = async () => ({ data: null, error: null })
  const authMethods = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: (_cb: any) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: { message: "Browser storage is blocked. Please enable cookies and site data." },
    }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: { message: "Browser storage is blocked. Please enable cookies and site data." },
    }),
    resetPasswordForEmail: noopAsync,
    updateUser: noopAsync,
    exchangeCodeForSession: noopAsync,
  }

  return new Proxy({} as any, {
    get(_, prop) {
      if (prop === "auth") return authMethods
      if (prop === "from") return () => ({ select: noopAsync, insert: noopAsync, update: noopAsync, delete: noopAsync, upsert: noopAsync })
      if (prop === "rpc") return noopAsync
      if (prop === "channel") return () => ({ on: () => ({ subscribe: () => {} }), subscribe: () => {} })
      if (prop === "removeChannel") return () => {}
      return noopAsync
    },
  })
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return createDummyClient()
  }

  if (typeof window === "undefined") {
    // Server-side: create a fresh client without browser storage
    try {
      return createBrowserClient(url, key, {
        auth: {
          persistSession: false,
          storage: undefined,
        },
      })
    } catch {
      return createDummyClient()
    }
  }

  if (!browserClient) {
    try {
      // Test if storage is accessible
      let safeStorage: any = undefined
      try {
        window.sessionStorage.setItem("sb-test", "1")
        window.sessionStorage.removeItem("sb-test")
        safeStorage = window.sessionStorage
      } catch {
        // Storage blocked
      }

      const memoryStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      }

      browserClient = createBrowserClient(url, key, {
        auth: {
          persistSession: !!safeStorage,
          storage: safeStorage || memoryStorage,
        },
      })
    } catch {
      // createBrowserClient itself threw
      return createDummyClient()
    }
  }

  return browserClient
}
