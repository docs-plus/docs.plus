import { immer } from 'zustand/middleware/immer'
import { Channel as TChannel } from '@types'

export interface IChannelStore {
  channels: Map<string, TChannel>
  bulkSetChannels: (channels: TChannel[]) => void
  clearAndInitialChannels: (channels: TChannel[]) => void
  setOrUpdateChannel: (channelId: string, channelData: TChannel) => void
  updateChannelRow: (channelId: string, channelData: TChannel) => void
  removeChannel: (channelId: string) => void
  clearChannels: () => void
}

const channelsStore = immer<IChannelStore>((set) => ({
  channels: new Map(),

  bulkSetChannels: (channels) => {
    set((state) => {
      channels.forEach((channel) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        state.channels.set(channel.id, channel)
      })
    })
  },

  setOrUpdateChannel: (channelId, channelData) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      state.channels.set(channelId, {
        ...state.channels.get(channelId),
        ...channelData
      })
    })
  },

  updateChannelRow: (channelId, channelData) => {
    set((state) => {
      const channel = state.channels.get(channelId)
      if (!channel) return

      // @ts-ignore
      state.channels.set(channelId, {
        ...channel,
        ...channelData,
        id: channel.id
      })
    })
  },

  removeChannel: (channelId) => {
    set((state) => {
      state.channels.delete(channelId)
    })
  },

  clearChannels: () => {
    set((state) => {
      state.channels.clear()
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
