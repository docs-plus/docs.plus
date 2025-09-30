import { createServerClient } from '@supabase/ssr'

export async function getSupabaseSession(context) {
  let supabase, session

  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
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
    const { data: userData, error: userError } = await supabase.auth.getUser().catch(console.error)

    if (userData?.user && !userError) {
      // User is authenticated, safe to get session
      const {
        data: { session: sessionData }
      } = await supabase.auth.getSession().catch(console.error)

      session = sessionData
    }
  }

  return session
}
