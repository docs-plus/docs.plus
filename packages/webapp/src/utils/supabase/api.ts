import { createServerClient, serializeCookieHeader } from '@supabase/ssr'
import { type NextApiRequest, type NextApiResponse } from 'next'

// Use SUPABASE_URL for server-side (container → host) or fallback to NEXT_PUBLIC_SUPABASE_URL (browser)
const getSupabaseUrl = () => {
  // Server-side: prefer SUPABASE_URL (host.docker.internal) if available
  if (process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL;
  }
  // Fallback: use NEXT_PUBLIC_SUPABASE_URL (localhost)
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
};

export default function createClient(req: NextApiRequest, res: NextApiResponse) {
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
      }
    }
  )

  return supabase
}
