import { Editor } from '@tiptap/react'
import type { ProviderStatus } from '@types'
import { immer } from 'zustand/middleware/immer'

type EditorSettings = {
  instance?: Editor
  providerSyncing: boolean
  loading: boolean
  selectionPos?: number
  filterResult: {
    sortedSlugs: Array<{
      type: 'parent' | 'child'
      text: string
      existsInParent: boolean
    }>
  }
  isMobile?: boolean
  isEditable: boolean
}

type Workspace = {
  workspaceId?: string
  metadata?: any
  broadcaster?: any
  providerStatus: ProviderStatus
  editor: EditorSettings
  hocuspocusProvider?: any
  deviceDetect?: any
  isAuthServiceAvailable?: boolean
  joinedWorkspace?: boolean
}

export interface IWorkspaceStore {
  settings: Workspace
  setWorkspaceSetting: (key: keyof Workspace, value: any) => void
  setWorkspaceEditorSettings: (settings: EditorSettings) => void
  setWorkspaceEditorSetting: (key: keyof EditorSettings, value: any) => void
}

const workspaceStore = immer<IWorkspaceStore>((set) => ({
  settings: {
    workspaceId: undefined,
    metadata: {
      documentId: undefined
    },
    broadcaster: undefined,
    providerStatus: 'saved',
    editor: {
      instance: undefined,
      providerSyncing: true,
      loading: true,
      selectionPos: 0,
      filterResult: { sortedSlugs: [] },
      isEditable: false
    },
    hocuspocusProvider: undefined,
    joinedWorkspace: false
  },
  // Update a single setting
  setWorkspaceSetting: (key, value) => {
    return set((state) => ({
      settings: { ...state.settings, [key]: value }
    }))
  },

  // Update multiple settings at once
  setWorkspaceEditorSettings: (settings) => {
    return set((state) => ({
      settings: { ...state.settings, editor: { ...state.settings.editor, ...settings } }
    }))
  },

  // Update a single editor setting
  setWorkspaceEditorSetting(key, value) {
    return set((state) => ({
      settings: { ...state.settings, editor: { ...state.settings.editor, [key]: value } }
    }))
  }
}))

export default workspaceStore
