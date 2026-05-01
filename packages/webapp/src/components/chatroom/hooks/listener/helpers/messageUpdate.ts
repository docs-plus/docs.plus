import { useChatStore, useStore } from '@stores'
import type { TMsgRow } from '@types'

/**
 * Realtime UPDATE handler. Supabase delivers the full updated row, so
 * `payload.new` is the authoritative `TMsgRow`. Computed fields like
 * `replied_message_details` are NOT carried over the wire — we rebuild
 * them from the in-memory channel map (or fall through to undefined).
 */
type MessageUpdatePayload = { new: TMsgRow }

export const messageUpdate = (payload: MessageUpdatePayload): void => {
  const row = payload.new
  const { id, channel_id: channelId, user_id: userId } = row
  if (!channelId) return

  const { setOrUpdateMessage, removeMessage, messagesByChannel } = useChatStore.getState()

  if (row.deleted_at) {
    removeMessage(channelId, id)
    // TODO: if pinned, drop from pinned messages.
    // TODO: if last in a group (carries avatar), recompute the group chrome.
    return
  }

  const messages = messagesByChannel.get(channelId)
  if (!messages) return

  const existing = messages.get(id)
  const userPresence = useStore.getState().usersPresence.get(userId)
  const repliedMessage = row.reply_to_message_id ? messages.get(row.reply_to_message_id) : undefined

  // Fall back to the existing reply quote when the replied-to row has
  // been paginated out of memory — otherwise edits to a message would
  // lose the quote until the next realtime echo re-hydrates it.
  const merged: TMsgRow = {
    ...existing,
    ...row,
    user_details: userPresence ?? existing?.user_details ?? null,
    replied_message_details: repliedMessage
      ? { message: repliedMessage, user: repliedMessage.user_details }
      : existing?.replied_message_details
  }

  setOrUpdateMessage(channelId, id, merged)
}
