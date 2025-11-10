import { createServerClient } from '@supabase/ssr'

// Use SUPABASE_URL for server-side (container → host) or fallback to NEXT_PUBLIC_SUPABASE_URL (browser)
const getSupabaseUrl = () => {
  // Server-side: prefer SUPABASE_URL (host.docker.internal) if available
  if (process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL;
  }
  // Fallback: use NEXT_PUBLIC_SUPABASE_URL (localhost)
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
};

export async function getSupabaseSession(context) {
  let supabase, session

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      supabase = createServerClient(
        getSupabaseUrl(),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            get(name) {
              return context.req.cookies[name]
            },
            set(name, value, options) {
              context.res.appendHeader('Set-Cookie', serialize(name, value, options))
            },
            remove(name, options) {
              context.res.appendHeader('Set-Cookie', serialize(name, '', options))
            }
          }
        }
      )

      // Verify user authentication first (server-validated)
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      console.log('user==========================================supabase.auth.getUser', {user, userError})

      if (user && !userError) {
        // User is authenticated, safe to get session
        const {
          data: { session: sessionData }
        } = await supabase.auth.getSession()

        session = sessionData
      }
    }
  } catch (error) {
    console.error('[getSupabaseSession]:', error)
  }

  return session
}
