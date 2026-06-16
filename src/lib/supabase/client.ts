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
          return new Proxy({} as any, {
            get() {
              return () => {}
            },
          })
        }
        return () => {}
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
    browserClient = createBrowserClient(url, key, {
      auth: {
        persistSession: true,
        storage: window.sessionStorage,
      },
    })
  }

  return browserClient
}
