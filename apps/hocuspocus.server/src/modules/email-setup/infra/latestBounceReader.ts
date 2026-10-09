import type { SupabaseClient } from '@supabase/supabase-js'

import type { EmailBounceRow } from '../types'

/** The same RPC as the bounce audit list, newest row only. Throws when it cannot read. */
export const createLatestBounceReader =
  (client: SupabaseClient | null) => async (): Promise<EmailBounceRow | null> => {
    if (!client) throw new Error('Supabase service-role client is not configured')
    const { data, error } = await client.rpc('get_email_bounces', {
      p_bounce_type: null,
      p_days: 365,
      p_limit: 1
    })
    if (error) throw new Error('get_email_bounces failed', { cause: error })
    return (data as EmailBounceRow[] | null)?.[0] ?? null
  }
