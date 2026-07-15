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

export type Workspace = {
  workspaceId?: string
  metadata?: any
  broadcaster?: any
  providerStatus: ProviderStatus
  // Set by onContentError: distinguishes a permanent schema/version freeze from
  // a transient network 'error' so the status chip can prompt a reload.
  contentForkError?: boolean
  editor: EditorSettings
  hocuspocusProvider?: any
  /** Mirrored from the provider on `authenticated` so edit-lock selectors react. */
  authorizedScope?: string | null
  deviceDetect?: any
  isAuthServiceAvailable?: boolean
  joinedWorkspace?: boolean
}

export interface IWorkspaceStore {
  settings: Workspace
  setWorkspaceSetting: (key: keyof Workspace, value: any) => void
  setWorkspaceSettings: (partial: Partial<Workspace>) => void
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
    authorizedScope: null,
    joinedWorkspace: false
  },
  // Update a single setting
  setWorkspaceSetting: (key, value) => {
    return set((state) => ({
      settings: { ...state.settings, [key]: value }
    }))
  },

  // Merge several top-level settings in one commit — one render, no intermediate state
  setWorkspaceSettings: (partial) => {
    return set((state) => ({
      settings: { ...state.settings, ...partial }
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
