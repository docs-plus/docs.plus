import { sendMessage } from '@api'
import { useAuthStore } from '@stores'
import type { TMsgRow } from '@types'

import { isDuplicateKeyError } from './postgresErrors'

export type RetryMessageInput = Pick<
  TMsgRow,
  'id' | 'channel_id' | 'content' | 'html' | 'reply_to_message_id'
>

export type RetryMessageResult = { ok: true } | { ok: false; error: string }

/**
 * Pure helper: re-issues `sendMessage` with the original client UUID so the
 * realtime echo reconciles the existing row in place. Treats Postgres 23505
 * as success (row was already persisted on a prior attempt). Caller owns
 * pending/sent/failed UI flips against its data source.
 */
export const retryMessage = async (row: RetryMessageInput): Promise<RetryMessageResult> => {
  const profile = useAuthStore.getState().profile
  if (!profile) return { ok: false, error: 'not signed in' }

  try {
    await sendMessage({
      id: row.id,
      content: row.content ?? '',
      channel_id: row.channel_id,
      user_id: profile.id,
      html: row.html ?? null,
      reply_to_message_id: row.reply_to_message_id ?? null
    })
    return { ok: true }
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) return { ok: true }
    const message = error instanceof Error ? error.message : 'Failed to send'
    return { ok: false, error: message }
  }
}
