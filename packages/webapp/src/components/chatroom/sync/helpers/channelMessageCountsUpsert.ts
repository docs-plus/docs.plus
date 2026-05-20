import { useAuthStore, useChatStore } from '@stores'
import type { Database } from '@types'

type TChannelMessageCountsRow = Database['public']['Tables']['channel_message_counts']['Row']

/**
 * Anon-only conflation: `message_count` → `unread_message_count` as a
 * "channel has activity" hint. Auth users get real per-user unread via
 * the `channel_members` subscription in useCatchUserPresences, so this
 * no-ops when a profile is present to prevent stale anon clobber.
 */
export const channelMessageCountsUpsert = (payload: { new: TChannelMessageCountsRow }) => {
  if (useAuthStore.getState()?.profile?.id) return

  const channelId = payload.new?.channel_id
  if (!channelId) return

  const { setOrUpdateChannel, channels } = useChatStore.getState()

  // Cast mirrors the store's internal @ts-ignore — TChannel is the
  // hydrated shape, but the Map merge is partial-safe at runtime.
  setOrUpdateChannel(channelId, {
    ...(channels.get(channelId) ?? { id: channelId }),
    unread_message_count: payload.new.message_count
  } as never)
}
