import { createServerClient, serializeCookieHeader } from '@supabase/ssr'
import { type NextApiRequest, type NextApiResponse } from 'next'

import { createSupabaseFetch } from './error-handler'
import { getSupabaseUrl } from './url'

export default function createClient(req: NextApiRequest, res: NextApiResponse) {
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
      // Add timeout to prevent hanging requests during compilation/runtime
      global: {
        fetch: async (url, options = {}) => {
          const controller = new AbortController()
          // 10s timeout for API routes (longer than server-props since API routes might do more work)
          const timeoutId = setTimeout(() => controller.abort(), 10000)

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
