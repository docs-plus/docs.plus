import { CommentMessageMemory, ComposerMessageMemory, TChannelSettings } from '@types'
import { immer } from 'zustand/middleware/immer'

type WorkspaceSettings = {
  channels: Map<string, TChannelSettings>
}

export interface IWorkspaceSettingsStore {
  workspaceSettings: WorkspaceSettings
  setWorkspaceChannelSetting: (channelId: string, key: keyof TChannelSettings, value: any) => void
  setCommentMessageMemory: (channelId: string, message: CommentMessageMemory | null) => void
  setReplyMessageMemory: (channelId: string, message: ComposerMessageMemory | null) => void
  setEditMessageMemory: (channelId: string, message: ComposerMessageMemory | null) => void
}

const useWorkspaceSettingsStore = immer<IWorkspaceSettingsStore>((set) => ({
  workspaceSettings: {
    channels: new Map()
  },

  setWorkspaceChannelSetting: (channelId, key, value) => {
    set((state) => {
      const channelSettings =
        state.workspaceSettings.channels.get(channelId) || ({} as TChannelSettings)
      channelSettings[key] = value
      state.workspaceSettings.channels.set(channelId, channelSettings)
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
  }
}))

function setMemory(set: any, memoryType: string, channelId: string, message: any) {
  set((state: any) => {
    const channelSettings = state.workspaceSettings.channels.get(channelId) || {}
    // One memory slot at a time — clear the others first.
    channelSettings.replyMessageMemory = null
    channelSettings.editMessageMemory = null
    channelSettings.commentMessageMemory = null
    channelSettings[memoryType] = message
    state.workspaceSettings.channels.set(channelId, channelSettings)
  })
}

export default useWorkspaceSettingsStore
