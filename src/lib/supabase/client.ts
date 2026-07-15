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

  const mockChannel: any = {
    on: () => mockChannel,
    subscribe: () => mockChannel,
  }

  return new Proxy({} as any, {
    get(_, prop) {
      if (prop === "auth") return authMethods
      if (prop === "from")
        return () => ({
          select: noopAsync,
          insert: noopAsync,
          update: noopAsync,
          delete: noopAsync,
          upsert: noopAsync,
        })
      if (prop === "rpc") return noopAsync
      if (prop === "channel") return () => mockChannel
      if (prop === "removeChannel") return () => {}
      return noopAsync
    },
  })
}

function storageIsUsable(): boolean {
  if (typeof window === "undefined") return false
  try {
    const key = "sb-storage-probe"
    window.localStorage.setItem(key, "1")
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return createDummyClient()
  }

  if (typeof window === "undefined") {
    // Server Components path — no browser storage.
    try {
      return createBrowserClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    } catch {
      return createDummyClient()
    }
  }

  if (!browserClient) {
    try {
      if (!storageIsUsable()) {
        // Privacy mode with blocked storage — keep app alive without auth thrash.
        const memoryStorage = {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
        browserClient = createBrowserClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            storage: memoryStorage,
          },
        })
      } else {
        // Default cookie storage from @supabase/ssr — must stay aligned with middleware.
        // Do NOT force sessionStorage; that fights cookie sessions and can remount pages
        // every TOKEN_REFRESH / cookie sync cycle (~tens of seconds).
        browserClient = createBrowserClient(url, key)
      }
    } catch {
      return createDummyClient()
    }
  }

  return browserClient
}
