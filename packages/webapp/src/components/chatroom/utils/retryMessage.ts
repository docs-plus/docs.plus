import { createThreadMessage, sendMessage } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'

import { isDuplicateKeyError } from './postgresErrors'

/**
 * Re-sends a previously-failed message with the same client UUID so the
 * realtime echo reconciles the existing row in place. Routes thread-channel
 * messages through `createThreadMessage`, all other rows through
 * `sendMessage`. No-op for rows that are missing, not in `failed` state,
 * or sent by a now-signed-out user.
 *
 * Multi-click safe: the synchronous status flip to `pending` makes a
 * second invocation bail before re-issuing the network call. Treats
 * Postgres `23505` (duplicate key) as success because the row was
 * already persisted on a prior attempt.
 */
export const retryMessage = async (channelId: string, messageId: string): Promise<void> => {
  const profile = useAuthStore.getState().profile
  if (!profile) return

  const row = useChatStore.getState().messagesByChannel.get(channelId)?.get(messageId)
  if (!row || row.status !== 'failed') return

  const { setMessageStatus, setOrUpdateMessage } = useChatStore.getState()

  setMessageStatus(channelId, messageId, 'pending')

  const isThreadMessage = !!row.thread_id && row.thread_id === row.channel_id

  try {
    if (isThreadMessage) {
      const workspaceId = useStore.getState().settings.workspaceId ?? ''
      await createThreadMessage({
        p_id: messageId,
        p_content: row.content ?? '',
        p_html: row.html ?? '',
        p_thread_id: row.thread_id as string,
        p_workspace_id: workspaceId
      })
      setMessageStatus(channelId, messageId, 'sent')
      return
    }

    const { data } = await sendMessage({
      id: messageId,
      content: row.content,
      channel_id: channelId,
      user_id: profile.id,
      html: row.html,
      reply_to_message_id: row.reply_to_message_id ?? null
    })

    if (data?.[0]) {
      setOrUpdateMessage(channelId, messageId, {
        ...data[0],
        user_details: profile,
        replied_message_details: row.replied_message_details,
        replied_message_preview: row.replied_message_preview,
        status: 'sent'
      })
    } else {
      setMessageStatus(channelId, messageId, 'sent')
    }
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      setMessageStatus(channelId, messageId, 'sent')
      return
    }
    const message = error instanceof Error ? error.message : 'Failed to send'
    setMessageStatus(channelId, messageId, 'failed', message)
  }
}
