import { immer } from 'zustand/middleware/immer'

/**
 * Tail-suppression marker: while set, that channel's unread is clamped to 0
 * at the write boundary (optimistic / channel row) and the read site
 * (useUnreadCount) so a server bump racing ahead of the debounced
 * advance_read_cursor cannot flash a phantom badge. Single-valued by design.
 */
export interface UnreadSuppressionState {
  unreadSuppressedChannelId: string | null
  setUnreadSuppressedChannel: (channelId: string | null) => void
}

const unreadSuppressionStore = immer<UnreadSuppressionState>((set) => ({
  unreadSuppressedChannelId: null,

  setUnreadSuppressedChannel: (channelId) =>
    set((state) => {
      state.unreadSuppressedChannelId = channelId
    })
}))

export default unreadSuppressionStore
