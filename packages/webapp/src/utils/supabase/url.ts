/**
 * Resolve the Supabase URL for the current environment.
 * Server-side: prefers SUPABASE_URL (container -> host) if available.
 * Client-side / fallback: uses NEXT_PUBLIC_SUPABASE_URL.
 */
export const getSupabaseUrl = () => {
  if (typeof window === 'undefined' && process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
}
