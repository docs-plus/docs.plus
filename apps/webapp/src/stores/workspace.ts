import { Editor } from '@tiptap/react'
import type { ProviderStatus } from '@types'
import type { DocumentMetadata } from '@utils/fetchDocument'
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
  /** Outside an open pad this is `NO_DOCUMENT`; check `documentId` before trusting it. */
  metadata: DocumentMetadata
  providerStatus: ProviderStatus
  // Set by onContentError: distinguishes a permanent schema/version freeze from
  // a transient network 'error' so the status chip can prompt a reload.
  contentForkError?: boolean
  // The IndexedDB mirror aborted a transaction (quota, disk, cleared data).
  // A side flag, never providerStatus 'error', because 'error' locks editing.
  mirrorWriteFailed?: boolean
  editor: EditorSettings
  hocuspocusProvider?: any
  /** Mirrored from the provider on `authenticated` so edit-lock selectors react. */
  authorizedScope?: string | null
  deviceDetect?: any
  isAuthServiceAvailable?: boolean
  /** The workspace join RPC for this user and document. `joined` means it succeeded. */
  workspaceJoin: 'pending' | 'joined' | 'failed'
}

export interface IWorkspaceStore {
  settings: Workspace
  setWorkspaceSetting: <K extends keyof Workspace>(key: K, value: Workspace[K]) => void
  setWorkspaceSettings: (partial: Partial<Workspace>) => void
  setWorkspaceEditorSettings: (settings: EditorSettings) => void
  setWorkspaceEditorSetting: (key: keyof EditorSettings, value: any) => void
}

// The first paint and Home hold no document, only an undefined documentId. The type
// says an open pad, so its readers stay typed; the owner rules check documentId first.
export const NO_DOCUMENT = { documentId: undefined } as unknown as DocumentMetadata

/** The open document's id, which is also its workspace id. */
export const selectDocumentId = (state: { settings: Workspace }): string | undefined =>
  state.settings.metadata.documentId

const workspaceStore = immer<IWorkspaceStore>((set) => ({
  settings: {
    metadata: NO_DOCUMENT,
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
    workspaceJoin: 'pending'
  },
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

  setWorkspaceEditorSettings: (settings) => {
    return set((state) => ({
      settings: { ...state.settings, editor: { ...state.settings.editor, ...settings } }
    }))
  },

  setWorkspaceEditorSetting(key, value) {
    return set((state) => ({
      settings: { ...state.settings, editor: { ...state.settings.editor, [key]: value } }
    }))
  }
}))

export default workspaceStore
