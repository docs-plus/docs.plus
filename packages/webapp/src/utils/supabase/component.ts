import { createBrowserClient } from '@supabase/ssr'
import { createSupabaseFetch } from './error-handler'

/**
 * Create Supabase browser client with offline handling
 * Prevents unnecessary requests when offline
 */
export function createClient() {
  const supabaseFetch = createSupabaseFetch()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        // Disable automatic reconnection when offline to prevent spam
        // Reconnection will happen when browser comes back online
        params: {
          eventsPerSecond: 30 // Limit event rate
        },
        // Only reconnect if we're actually online
        reconnectAfterMs: (tries: number) => {
          // If offline, don't reconnect (prevents spam)
          // This callback only runs on client when realtime tries to reconnect
          if (!navigator.onLine) {
            return null // Stop reconnecting
          }
          // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
          return Math.min(1000 * Math.pow(2, tries), 10000)
        }
      },
      // Global fetch options to prevent requests when offline
      global: {
        fetch: async (url, options = {}) => {
          // Skip requests if offline (prevents retry spam)
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
