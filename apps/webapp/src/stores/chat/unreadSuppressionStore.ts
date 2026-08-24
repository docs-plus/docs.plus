import { immer } from 'zustand/middleware/immer'

/**
 * Tail-suppression marker: while set, unread is clamped to 0 at the write
 * boundary and the read site. A server bump racing the debounced
 * advance_read_cursor then cannot flash a phantom badge. Single-valued.
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
