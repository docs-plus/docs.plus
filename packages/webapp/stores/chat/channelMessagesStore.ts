import { immer } from 'zustand/middleware/immer'

/**
 * Message store for chat application. Manages messages using Zustand with Immer.
 *
 * - messagesByChannel: Map with channelId as key and Map of messages as value.
 *
 * Functions:
 * - setOrUpdateMessage(channelId, messageId, messageData): Add/update a message in a channel.
 * - bulkSetMessages(channelId, newMessages): Add multiple messages to a channel.
 * - removeMessage(channelId, messageId): Remove a message from a channel.
 * - clearChannelMessages(channelId): Clear all messages from a channel.
 *
 * Using Immer for immutable updates. Note that debugging involves Proxy objects.
 */

interface ChannelMessagesState {
  messagesByChannel: Map<string, Map<string, any>>
  lastMessages: Map<string, any> // last message for each channel
  setOrUpdateMessage: (channelId: string, messageId: string, messageData: any) => void
  bulkSetMessages: (channelId: string, newMessages: Array<any>) => void
  removeMessage: (channelId: string, messageId: string) => void
  clearChannelMessages: (channelId: string) => void
  replaceMessages: (channelId: string, newMessages: Map<string, any>) => void
  setLastMessage: (channelId: string, message: any) => void
}

const channelMessagesStore = immer<ChannelMessagesState>((set) => ({
  messagesByChannel: new Map(),
  lastMessages: new Map(),

  setOrUpdateMessage: (channelId: string, messageId: string, messageData: any) => {
    set((state) => {
      const channelMessages = state.messagesByChannel.get(channelId) || new Map()
      channelMessages.set(messageId, {
        ...(channelMessages.get(messageId) || {}),
        ...messageData
      })
      state.messagesByChannel.set(channelId, channelMessages)
    })
  },

  replaceMessages: (channelId: string, newMessages: Map<string, any>) => {
    set((state) => {
      state.messagesByChannel.set(channelId, newMessages)
    })
  },

  bulkSetMessages: (channelId: string, newMessages: Array<any>) => {
    set((state) => {
      const existingMessages = state.messagesByChannel.get(channelId) || new Map()
      newMessages.forEach((message) => {
        existingMessages.set(message.id, message)
      })
      state.messagesByChannel.set(channelId, existingMessages)
    })
  },

  removeMessage: (channelId: string, messageId: string) => {
    set((state) => {
      const channelMessages = state.messagesByChannel.get(channelId)
      if (channelMessages) {
        channelMessages.delete(messageId)
      }
    })
  },

  clearChannelMessages: (channelId: string) => {
    set((state) => {
      state.messagesByChannel.delete(channelId)
    })
  },

  setLastMessage: (channelId: string, message: any) => {
    set((state) => {
      state.lastMessages.set(channelId, message)
    })
  }
}))

export default channelMessagesStore
