import { getUserById } from '@api'
import { useChatStore, useStore } from '@stores'
import type { Profile, TMsgRow } from '@types'

const fetchUserDetails = async (userId: string): Promise<Profile | null> => {
  try {
    const { data, error } = await getUserById(userId)
    if (error || !data) {
      console.warn('[UserDetails] - user not found', {
        userId,
        code: error?.code,
        message: error?.message
      })
      return null
    }
    return data as Profile
  } catch (err) {
    console.warn('[UserDetails] - fetch failed', { userId, err })
    return null
  }
}

/**
 * Realtime INSERT handler. The payload is authoritative — we upsert
 * the row by its server id and stamp `status: 'sent'`. If the row was
 * already in the store as `pending` (the optimistic write), this
 * transitions it in place without a remove + re-add.
 *
 * No more `'fake_id'` placeholder. Two messages submitted concurrently
 * each carry their own UUID and reconcile independently.
 *
 * `payload.new` is a raw `messages` row — it does NOT carry computed
 * fields like `replied_message_details` (those come from RPCs only).
 * We rebuild that field from the in-memory map first, and fall back
 * to whatever the existing store row already has (e.g. an optimistic
 * row that hydrated it from `replyMessageMemory` at send time).
 */
export const messageInsert = async (payload: { new: TMsgRow }) => {
  const channelId = payload.new?.channel_id
  if (!channelId) return
  if (payload.new.deleted_at) return

  const setOrUpdateMessage = useChatStore.getState().setOrUpdateMessage
  const usersPresence = useStore.getState().usersPresence
  const channelMessages = useChatStore.getState().messagesByChannel.get(channelId)
  const existingRow = channelMessages?.get(payload.new.id)

  const cachedDetails = usersPresence.get(payload.new.user_id) ?? existingRow?.user_details ?? null

  const replyTo = payload.new.reply_to_message_id
    ? channelMessages?.get(payload.new.reply_to_message_id)
    : null

  const repliedDetails = replyTo
    ? { message: replyTo, user: replyTo?.user_details }
    : existingRow?.replied_message_details

  const reconciled = {
    ...payload.new,
    user_details: cachedDetails,
    replied_message_details: repliedDetails,
    replied_message_preview:
      payload.new.replied_message_preview ?? existingRow?.replied_message_preview,
    status: 'sent' as const,
    statusError: undefined
  }

  // Upsert immediately so the message renders without waiting on a fetch.
  setOrUpdateMessage(channelId, payload.new.id, reconciled)

  // Hydrate user_details in the background. Reads the latest row from
  // the store before re-upserting so a realtime UPDATE that landed
  // between the two writes (edit, reaction, soft-delete) isn't clobbered.
  if (!cachedDetails) {
    const fetched = await fetchUserDetails(payload.new.user_id)
    if (fetched) {
      useStore.getState().setOrUpdateUserPresence(payload.new.user_id, fetched)
      const latest = useChatStore.getState().messagesByChannel.get(channelId)?.get(payload.new.id)
      if (latest) {
        setOrUpdateMessage(channelId, payload.new.id, { ...latest, user_details: fetched })
      }
    }
  }
}
