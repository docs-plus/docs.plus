import { createServerClient } from '@supabase/ssr'
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

// Use SUPABASE_URL for server-side (container → host) or fallback to NEXT_PUBLIC_SUPABASE_URL (browser)
const getSupabaseUrl = () => {
  // Server-side: prefer SUPABASE_URL (host.docker.internal) if available
  if (typeof window === 'undefined' && process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL
  }
  // Client-side or fallback: use NEXT_PUBLIC_SUPABASE_URL (localhost)
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
}

export const supabaseServer = (cookieStore: ReadonlyRequestCookies) =>
  createServerClient(getSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      }
    }
  })
