import { TAggregateChannelData } from '@api'
import { TMsgRow } from '@types'
import { immer } from 'zustand/middleware/immer'

// Cross-slice action: lands every channel-boot mutation in one immer
// pass so consumers don't observe transient half-initialised state
// between writes. `state: any` mirrors destroyChatRoom in chatroom.ts.
interface IBootstrapStore {
  bootstrapChannel: (channelId: string, channelData: TAggregateChannelData, userId?: string) => void
}

const bootstrapStore = immer<IBootstrapStore>((set) => ({
  bootstrapChannel: (channelId, channelData, userId) => {
    set((state: any) => {
      // 1. Canonical channel row
      if (channelData.channel_info) {
        state.channels.set(channelId, {
          ...state.channels.get(channelId),
          ...(channelData.channel_info as Record<string, unknown>)
        })
      }

      // 2. Per-channel UI settings (unread cursor, member flag, info)
      const channelSettings = state.workspaceSettings.channels.get(channelId) ?? {}
      channelSettings.unreadMessage = channelData.unread_message
      channelSettings.lastReadMessageId = channelData.last_read_message_id
      channelSettings.lastReadMessageTimestamp = channelData.last_read_message_timestamp
      channelSettings.totalMsgSinceLastRead = channelData.total_messages_since_last_read
      channelSettings.isUserChannelMember = channelData.is_user_channel_member || false
      if (channelData.channel_info) channelSettings.channelInfo = channelData.channel_info
      state.workspaceSettings.channels.set(channelId, channelSettings)

      // 3. Caller's channel-member row (signed-in only)
      if (userId && channelData.channel_member_info) {
        const members = state.channelMembers.get(channelId) ?? new Map()
        members.set(userId, {
          ...(channelData.channel_member_info as Record<string, unknown>),
          id: userId
        })
        state.channelMembers.set(channelId, members)
      }

      // 4. Pinned messages
      if (channelData.pinned_messages) {
        const pinned = new Map()
        ;(channelData.pinned_messages as TMsgRow[]).forEach((msg) => pinned.set(msg.id, msg))
        state.pinnedMessages.set(channelId, pinned)
      }

      // 5. Message window (clear-and-replace; the RPC returns the
      //    authoritative page newest-first, the UI renders oldest-first)
      if (channelData.last_messages) {
        const messages = new Map()
        const reversed = [...(channelData.last_messages as TMsgRow[])].reverse()
        reversed.forEach((msg) => messages.set(msg.id, msg))
        state.messagesByChannel.set(channelId, messages)
      } else {
        state.messagesByChannel.delete(channelId)
      }

      // 6. Pagination cursors
      state.paginationByChannel.set(channelId, {
        olderCursor: channelData.older_cursor ?? null,
        newerCursor: channelData.newer_cursor ?? null,
        hasMoreOlder: channelData.has_more_older ?? false,
        hasMoreNewer: channelData.has_more_newer ?? false,
        isLoadingOlder: false,
        isLoadingNewer: false
      })
    })
  }
}))

export default bootstrapStore
