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
        reconnectAfterMs: (tries: number) => {
          if (!navigator.onLine) {
            return 60_000
          }
          return Math.min(1000 * Math.pow(2, tries), 10000)
        }
      },
      global: {
        fetch: async (url, options = {}) => {
          if (!navigator.onLine) {
            return Promise.reject(new Error('Network offline'))
          }
          return supabaseFetch(url, options)
        }
      }
    }
  )

  return supabase
}
