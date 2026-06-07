import { createServerClient, serializeCookieHeader } from '@supabase/ssr'
import { type GetServerSidePropsContext } from 'next'

import { createSupabaseFetch } from './error-handler'
import { getSupabaseUrl } from './url'

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
