import { immer } from 'zustand/middleware/immer'

export interface ChannelPinnedMessagesState {
  pinnedMessages: Map<string, Map<string, any>>
  addChannelPinnedMessage: (channelId: string, message: any) => void
  removeChannelPinnedMessage: (channelId: string, messageId: string) => void
  bulkSetChannelPinnedMessages: (channelId: string, messages: any[]) => void
}

const channelPinnedMessagesStore = immer<ChannelPinnedMessagesState>((set) => ({
  pinnedMessages: new Map(),

  addChannelPinnedMessage: (channelId, message) =>
    set((state) => {
      const channelMessages = state.pinnedMessages.get(channelId) || new Map()
      channelMessages.set(message.id, message)
      state.pinnedMessages.set(channelId, channelMessages)
    }),

  removeChannelPinnedMessage: (channelId, messageId) =>
    set((state) => {
      const channelMessages = state.pinnedMessages.get(channelId)
      if (channelMessages) {
        channelMessages.delete(messageId)
      }
    }),

  bulkSetChannelPinnedMessages: (channelId, messages) =>
    set((state) => {
      const channelMessages = state.pinnedMessages.get(channelId) || new Map()
      messages.forEach((message) => channelMessages.set(message.id, message))
      state.pinnedMessages.set(channelId, channelMessages)
    })
}))

export default channelPinnedMessagesStore
