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
      const channelInfo = channelData.channel_info as Record<string, unknown> | undefined

      if (channelInfo) {
        state.channels.set(channelId, {
          ...state.channels.get(channelId),
          ...channelInfo
        })
      }

      const channelSettings = state.workspaceSettings.channels.get(channelId) ?? {}
      channelSettings.isUserChannelMember = channelData.is_user_channel_member || false
      if (channelInfo) channelSettings.channelInfo = channelInfo
      state.workspaceSettings.channels.set(channelId, channelSettings)

      if (userId && channelData.channel_member_info) {
        const members = state.channelMembers.get(channelId) ?? new Map()
        members.set(userId, {
          ...(channelData.channel_member_info as Record<string, unknown>),
          id: userId
        })
        state.channelMembers.set(channelId, members)
      }

      if (channelData.pinned_messages) {
        const pinned = new Map()
        ;(channelData.pinned_messages as TMsgRow[]).forEach((msg) => pinned.set(msg.id, msg))
        state.pinnedMessages.set(channelId, pinned)
      }

      const peerSeq = channelData.peer_max_read_seq
      if (typeof peerSeq === 'number') {
        const current = state.peerReadSeq.get(channelId) ?? 0
        if (peerSeq > current) state.peerReadSeq.set(channelId, peerSeq)
      }
    })
  }
}))

export default bootstrapStore
