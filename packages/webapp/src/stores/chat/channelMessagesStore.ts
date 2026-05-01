import type { MessageStatus, TMsgRow } from '@types'
import { immer } from 'zustand/middleware/immer'

/**
 * Channel-scoped message store. Rows are keyed by their stable
 * server/client UUID — there is no `'fake_id'` placeholder.
 *
 * `setMessageStatus` mutates the existing row in place. If the row
 * does not exist, the call is a no-op (the realtime listener may
 * race with the local error path).
 *
 * The previous `lastMessages` side-store has been removed: its only
 * reader was `messageUpdate`'s deletion-tracker, which now derives
 * the most-recent row directly from `messagesByChannel`.
 */
interface ChannelMessagesState {
  messagesByChannel: Map<string, Map<string, TMsgRow>>
  setOrUpdateMessage: (channelId: string, messageId: string, messageData: Partial<TMsgRow>) => void
  bulkSetMessages: (channelId: string, newMessages: ReadonlyArray<TMsgRow>) => void
  removeMessage: (channelId: string, messageId: string) => void
  clearChannelMessages: (channelId: string) => void
  replaceMessages: (channelId: string, newMessages: Map<string, TMsgRow>) => void
  setMessageStatus: (
    channelId: string,
    messageId: string,
    status: MessageStatus,
    error?: string
  ) => void
}

const channelMessagesStore = immer<ChannelMessagesState>((set) => ({
  messagesByChannel: new Map(),

  setOrUpdateMessage: (channelId, messageId, messageData) => {
    set((state) => {
      const channelMessages = state.messagesByChannel.get(channelId) ?? new Map<string, TMsgRow>()
      const existing = channelMessages.get(messageId)
      channelMessages.set(messageId, { ...(existing ?? ({} as TMsgRow)), ...messageData })
      state.messagesByChannel.set(channelId, channelMessages)
    })
  },

  replaceMessages: (channelId, newMessages) => {
    set((state) => {
      state.messagesByChannel.set(channelId, newMessages)
    })
  },

  bulkSetMessages: (channelId, newMessages) => {
    set((state) => {
      const existingMessages = state.messagesByChannel.get(channelId) ?? new Map<string, TMsgRow>()
      for (const message of newMessages) existingMessages.set(message.id, message)
      state.messagesByChannel.set(channelId, existingMessages)
    })
  },

  removeMessage: (channelId, messageId) => {
    set((state) => {
      state.messagesByChannel.get(channelId)?.delete(messageId)
    })
  },

  clearChannelMessages: (channelId) => {
    set((state) => {
      state.messagesByChannel.delete(channelId)
    })
  },

  setMessageStatus: (channelId, messageId, status, error) => {
    set((state) => {
      const channel = state.messagesByChannel.get(channelId)
      const existing = channel?.get(messageId)
      if (!channel || !existing) return
      channel.set(messageId, {
        ...existing,
        status,
        statusError: status === 'failed' ? error : undefined
      })
    })
  }
}))

export default channelMessagesStore
