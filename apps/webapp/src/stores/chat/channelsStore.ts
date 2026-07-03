import { Channel as TChannel } from '@types'
import { immer } from 'zustand/middleware/immer'

export interface IChannelStore {
  channels: Map<string, TChannel>
  bulkSetChannels: (channels: TChannel[]) => void
  clearAndInitialChannels: (channels: TChannel[]) => void
  setOrUpdateChannel: (channelId: string, channelData: TChannel) => void
  updateChannelRow: (channelId: string, channelData: Partial<TChannel>) => void
  removeChannel: (channelId: string) => void
}

const channelsStore = immer<IChannelStore>((set) => ({
  channels: new Map(),

  bulkSetChannels: (channels) => {
    set((state) => {
      channels.forEach((channel) => {
        // @ts-ignore
        state.channels.set(channel.id, channel)
      })
    })
  },

  setOrUpdateChannel: (channelId, channelData) => {
    set((state: any) => {
      const merged = { ...state.channels.get(channelId), ...channelData }
      // Anon `channelMessageCountsUpsert` lands here with a conflated activity
      // hint; clamp so the ProseMirror heading badge (driven via UNREAD_SYNC)
      // matches the read-gated React badges while the user reads at tail.
      if (
        state.unreadSuppressedChannelId === channelId &&
        channelData &&
        'unread_message_count' in channelData
      ) {
        merged.unread_message_count = 0
      }
      state.channels.set(channelId, merged)
    })
  },

  updateChannelRow: (channelId, channelData) => {
    set((state: any) => {
      const channel = state.channels.get(channelId)
      if (!channel) return

      const merged = { ...channel, ...channelData, id: channel.id }
      // Only clamp when the incoming row actually carries an unread bump;
      // unrelated row updates (mute, name, member flags) must not zero
      // an existing value just because suppression is on.
      if (
        state.unreadSuppressedChannelId === channelId &&
        channelData &&
        'unread_message_count' in channelData
      ) {
        merged.unread_message_count = 0
      }
      state.channels.set(channelId, merged)
    })
  },

  removeChannel: (channelId) => {
    set((state) => {
      state.channels.delete(channelId)
    })
  },

  clearAndInitialChannels: (channels) => {
    set((state) => {
      state.channels = new Map()
      channels.forEach((channel) => {
        // @ts-ignore
        state.channels.set(channel.id, channel)
      })
    })
  }
}))

export default channelsStore
