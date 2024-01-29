import { immer } from 'zustand/middleware/immer'
import { Database } from '@types'
import { useStore } from '@stores'

export type TChannel = Database['public']['Tables']['channels']['Row'] & {
  member_count: number | null
}

export interface IChannelStore {
  channels: Map<string, TChannel>
  bulkSetChannels: (channels: TChannel[]) => void
  clearAndInitialChannels: (channels: TChannel[]) => void
  setOrUpdateChannel: (channelId: string, channelData: TChannel) => void
  removeChannel: (channelId: string) => void
  clearChannels: () => void
}

const getWorkspaceId = () => {
  return useStore.getState().settings.workspaceId
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
    let newChannelId: string = channelId
    if (+newChannelId === 1) newChannelId = `1_${getWorkspaceId()}`
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      state.channels.set(newChannelId, channelData)
    })
  },

  removeChannel: (channelId) => {
    let newChannelId: string = channelId
    if (+newChannelId === 1) newChannelId = `1_${getWorkspaceId()}`
    set((state) => {
      state.channels.delete(newChannelId)
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
        state.channels.set(channel.id, channel)
      })
    })
  }
}))

export default channelsStore
