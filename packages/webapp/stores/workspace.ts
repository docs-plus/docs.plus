import { immer } from 'zustand/middleware/immer'
import { Editor } from '@tiptap/react'

type EditorSettings = {
  instance?: Editor
  rendering?: boolean
  loading?: boolean
  applyingFilters?: boolean
  selectionPos?: number
  filterResult?: any
  isMobile?: boolean
  presentUsers?: any
}

type Workspace = {
  workspaceId?: string
  metadata?: any
  broadcaster?: any
  editor: EditorSettings
  hocuspocusProvider?: any
  deviceDetect?: any
  isAuthServiceAvailable?: boolean
}

export interface IWorkspaceStore {
  settings: Workspace
  setWorkspaceSetting: (key: keyof Workspace, value: any) => void
  setWorkspaceSettings: (settings: Workspace) => void
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
    editor: {
      instance: undefined,
      rendering: true,
      loading: true,
      applyingFilters: false,
      selectionPos: 0,
      filterResult: [],
      presentUsers: []
    },
    hocuspocusProvider: undefined
  },
  // Update a single setting
  setWorkspaceSetting: (key, value) => {
    return set((state) => ({
      settings: { ...state.settings, [key]: value }
    }))
  },

  // Update multiple settings at once
  setWorkspaceSettings: (settings) => {
    return set((state) => ({
      settings: { ...state.settings, ...settings }
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
