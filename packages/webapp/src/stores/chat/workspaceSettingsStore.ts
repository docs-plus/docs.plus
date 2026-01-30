import { TChannelSettings } from '@types'
import { immer } from 'zustand/middleware/immer'

type WorkspaceSettings = {
  workspaceId?: string
  workspaceBroadcaster?: any
  activeChannelId?: string // we use this id for typing indicators
  typingIndicators: { [key: string]: Map<string, any> }
  channels: Map<string, TChannelSettings>
}

export interface IWorkspaceSettingsStore {
  workspaceSettings: WorkspaceSettings
  setWorkspaceChannelSettings: (channelId: string, value: TChannelSettings) => void
  setWorkspaceChannelSetting: (channelId: string, key: keyof TChannelSettings, value: any) => void
  setWorkspaceSetting: (key: keyof WorkspaceSettings, value: any) => void
  setWorkspaceSettings: (settings: WorkspaceSettings) => void
  setCommentMessageMemory: (channelId: string, message: any) => void
  setReplyMessageMemory: (channelId: string, message: any) => void
  setMessageDraftMemory: (channelId: string, message: any) => void
  setEditMessageMemory: (channelId: string, message: any) => void
  setForwardMessageMemory: (channelId: string, message: any) => void
  setTypingIndicator: (channelId: string, user: any) => void
  removeTypingIndicator: (channelId: string, user: any) => void
  clearMemoryStates: (channelId: string) => void
}

const useWorkspaceSettingsStore = immer<IWorkspaceSettingsStore>((set) => ({
  workspaceSettings: {
    workspaceId: undefined,
    workspaceBroadcaster: undefined,
    channels: new Map(),
    activeChannelId: undefined,
    typingIndicators: {}
  },

  setWorkspaceChannelSettings: (channelId, value) => {
    set((state) => {
      state.workspaceSettings.channels.set(channelId, value)
    })
  },

  setWorkspaceChannelSetting: (channelId, key, value) => {
    set((state) => {
      const channelSettings =
        state.workspaceSettings.channels.get(channelId) || ({} as TChannelSettings)
      channelSettings[key] = value
      state.workspaceSettings.channels.set(channelId, channelSettings)
    })
  },

  setWorkspaceSetting: (key, value) => {
    set((state) => {
      state.workspaceSettings[key] = value
    })
  },

  setWorkspaceSettings: (settings) => {
    set((state) => {
      Object.assign(state.workspaceSettings, settings)
    })
  },

  setMessageDraftMemory: (channelId, message) => {
    setMemory(set, 'messageDraftMemory', channelId, {
      text: message.text,
      html: message.html
    })
  },

  setCommentMessageMemory: (channelId, message) => {
    setMemory(set, 'commentMessageMemory', channelId, message)
  },

  setReplyMessageMemory: (channelId, message) => {
    setMemory(set, 'replyMessageMemory', channelId, message)
  },

  setEditMessageMemory: (channelId, message) => {
    setMemory(set, 'editMessageMemory', channelId, message)
  },

  setForwardMessageMemory: (channelId, message) => {
    setMemory(set, 'forwardMessageMemory', channelId, message)
  },

  setTypingIndicator: (channelId, user) => {
    return set((state) => {
      const typingIndicators = state.workspaceSettings.typingIndicators

      if (!typingIndicators[channelId]) {
        typingIndicators[channelId] = new Map()
      }

      typingIndicators[channelId].set(user.id, user)
    })
  },

  removeTypingIndicator: (channelId, user) => {
    return set((state) => {
      const typingIndicators = state.workspaceSettings.typingIndicators

      if (typingIndicators[channelId]) {
        typingIndicators[channelId].delete(user.id)
      }
    })
  },

  clearMemoryStates: (channelId) => {
    set((state: any) => {
      const channelSettings = state.workspaceSettings.channels.get(channelId) || {}
      channelSettings.messageDraftMemory = null
      channelSettings.replyMessageMemory = null
      channelSettings.editMessageMemory = null
      channelSettings.forwardMessageMemory = null
      channelSettings.commentMessageMemory = null
      state.workspaceSettings.channels.set(channelId, channelSettings)
    })
  }
}))

// helper function to set memory for a channel
function setMemory(set: any, memoryType: string, channelId: string, message: any) {
  set((state: any) => {
    const channelSettings = state.workspaceSettings.channels.get(channelId) || {}
    // clear all memory states for the channel before setting the memory type to the message
    channelSettings.messageDraftMemory = null
    channelSettings.replyMessageMemory = null
    channelSettings.editMessageMemory = null
    channelSettings.forwardMessageMemory = null
    channelSettings.commentMessageMemory = null
    // set the memory type to the message
    channelSettings[memoryType] = message
    state.workspaceSettings.channels.set(channelId, channelSettings)
  })
}

export default useWorkspaceSettingsStore
