import { immer } from 'zustand/middleware/immer'

type TChannelSettings = {
  name: any
  channelId?: string | null
  channelInfo?: any
  isUserChannelMember?: boolean
  isUserChannelOwner?: boolean
  isUserChannelAdmin?: boolean
  userPickingEmoji?: boolean
  replayMessageMemory?: any
  commentMessageMemory?: any
  editMessageMemory?: any
  forwardMessageMemory?: any
  unreadMessage?: boolean
  scrollPage?: number
  scrollPageOffset?: number
  lastReadMessageId?: string | null
  lastReadMessageTimestamp?: Date
  totalMsgSinceLastRead?: number
  totalMsgSincLastRead?: number
}

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
  setReplayMessageMemory: (channelId: string, message: any) => void
  setEditMessageMemory: (channelId: string, message: any) => void
  setForwardMessageMemory: (channelId: string, message: any) => void
  setTypingIndicator: (channelId: string, user: any) => void
  removeTypingIndicator: (channelId: string, user: any) => void
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

  setCommentMessageMemory: (channelId, message) => {
    setMemory(set, 'commentMessageMemory', channelId, message)
  },

  setReplayMessageMemory: (channelId, message) => {
    setMemory(set, 'replayMessageMemory', channelId, message)
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
  }
}))

function setMemory(set: any, memoryType: string, channelId: string, message: any) {
  set((state: any) => {
    const channelSettings = state.workspaceSettings.channels.get(channelId) || {}
    channelSettings[memoryType] = message
    state.workspaceSettings.channels.set(channelId, channelSettings)
  })
}

export default useWorkspaceSettingsStore
