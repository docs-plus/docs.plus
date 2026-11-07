import { createBrowserClient } from '@supabase/ssr'

import { createSupabaseFetch } from './error-handler'

export function createClient() {
  const supabaseFetch = createSupabaseFetch()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 30
        },
        // No `navigator.onLine` branch: Chrome can hold it false after sleep while the
        // network works, which turned a 10 s retry into a 60 s one (2026-11-07).
        reconnectAfterMs: (tries: number) => Math.min(1000 * Math.pow(2, tries), 10000)
      },
      global: {
        // No `navigator.onLine` guard: a stale false flag refused every Supabase call,
        // sign-in included, with nothing in any log (2026-11-07). Offline fails on its own.
        fetch: (url, options = {}) => supabaseFetch(url, options)
      }
    }
  )

  return supabase
}
