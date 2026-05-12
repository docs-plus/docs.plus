import { useChatStore } from '@stores'
import type { Database } from '@types'

type TChannelMessageCountsRow = Database['public']['Tables']['channel_message_counts']['Row']

// Anon users subscribe to channel_message_counts without preloading
// `channels`, so the local cache is often empty when the first event
// arrives. `updateChannelRow` would bail in that case and the TOC badge
// would never paint; `setOrUpdateChannel` merges over whatever is there,
// so a minimal stub keeps the badge feature deterministic on first paint.
export const channelMessageCountsUpsert = (payload: { new: TChannelMessageCountsRow }) => {
  const channelId = payload.new?.channel_id
  if (!channelId) return

  const { setOrUpdateChannel, channels } = useChatStore.getState()

  const next = {
    ...(channels.get(channelId) ?? { id: channelId }),
    unread_message_count: payload.new.message_count
  }

  // Cast mirrors the store's internal @ts-ignore — TChannel is the
  // hydrated shape, but the Map merge is partial-safe at runtime.
  setOrUpdateChannel(channelId, next as never)
}
