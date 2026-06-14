import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Return a dummy proxy object so static prerendering doesn't crash during build
    return new Proxy({} as any, {
      get(_, prop) {
        if (prop === 'auth') {
          return new Proxy({} as any, {
            get() { return () => {} }
          })
        }
        return () => {}
      }
    })
  }

  return createBrowserClient(url, key)
}
