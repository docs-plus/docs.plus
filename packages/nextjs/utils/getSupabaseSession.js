import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export async function getSupabaseSession(context) {
  let supabase, session

  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    supabase = createPagesServerClient(context)
    const {
      data: { session: sessionData }
    } = await supabase.auth.getSession()

    session = sessionData
  }

  return session
}
