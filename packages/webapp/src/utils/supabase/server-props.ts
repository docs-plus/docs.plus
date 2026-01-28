import { type GetServerSidePropsContext } from 'next'
import { createServerClient, serializeCookieHeader } from '@supabase/ssr'
import { createSupabaseFetch } from './error-handler'

// Use SUPABASE_URL for server-side (container → host) or fallback to NEXT_PUBLIC_SUPABASE_URL (browser)
const getSupabaseUrl = () => {
  // Server-side: prefer SUPABASE_URL (host.docker.internal) if available
  if (process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL
  }
  // Fallback: use NEXT_PUBLIC_SUPABASE_URL (localhost)
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
}

export function createClient({ req, res }: GetServerSidePropsContext) {
  const supabaseFetch = createSupabaseFetch()

  const supabase = createServerClient(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.keys(req.cookies).map((name) => ({ name, value: req.cookies[name] || '' }))
        },
        setAll(cookiesToSet) {
          res.setHeader(
            'Set-Cookie',
            cookiesToSet.map(({ name, value, options }) =>
              serializeCookieHeader(name, value, options)
            )
          )
        }
      },
      // Add timeout to prevent hanging requests
      global: {
        fetch: async (url, options = {}) => {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

          try {
            return await supabaseFetch(url, {
              ...options,
              signal: controller.signal
            })
          } finally {
            clearTimeout(timeoutId)
          }
        }
      }
    }
  )

  return supabase
}
