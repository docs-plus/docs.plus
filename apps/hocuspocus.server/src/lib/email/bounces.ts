import type { SupabaseClient } from '@supabase/supabase-js'

import type { EmailBounceEvent } from '../../types/email.types'
import { emailLogger } from '../logger'
import { maskEmail } from '../maskEmail'

/**
 * The one writer for `email_bounces`. The RPC turns email off for a hard bounce
 * or a complaint. Throws on a missing client or an RPC error, so a webhook can
 * answer 5xx and let the provider retry.
 */
export async function recordEmailBounce(
  client: SupabaseClient | null,
  { email, bounce_type, provider, reason }: EmailBounceEvent
): Promise<string> {
  if (!client) {
    emailLogger.error(
      { to: maskEmail(email), bounce_type },
      'Bounce not recorded: no Supabase client'
    )
    throw new Error('Supabase service-role client is not configured')
  }

  const { data, error } = await client.rpc('record_email_bounce', {
    p_email: email,
    p_bounce_type: bounce_type,
    p_provider: provider || null,
    p_reason: reason || null
  })
  if (error) {
    emailLogger.error({ err: error, to: maskEmail(email), bounce_type }, 'Failed to record bounce')
    throw new Error('record_email_bounce failed', { cause: error })
  }

  emailLogger.info({ to: maskEmail(email), bounce_type, provider }, 'Email bounce recorded')
  return data as string
}
