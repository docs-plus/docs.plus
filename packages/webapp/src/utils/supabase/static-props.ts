import { createClient as createClientPrimitive } from '@supabase/supabase-js'

import { createSupabaseFetch } from './error-handler'

export function createClient() {
  const supabaseFetch = createSupabaseFetch()

  const supabase = createClientPrimitive(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: supabaseFetch
      }
    }
  )

  return supabase
}
