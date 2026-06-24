import { deleteChatMediaFromStorage } from '@components/chatroom/utils/uploadChatMedia'
import type { MessageMediaItem } from '@types'
import { create } from 'zustand'

export type ComposerAttachment = {
  id: string
  file?: File
  item?: MessageMediaItem
  status: 'uploading' | 'ready' | 'error'
  progress?: number
  error?: string
  /** Row-backed media — do not delete storage on composer clear/cancel. */
  persisted?: boolean
  spoiler?: boolean
}

export const composerAttachmentKey = (workspaceId: string, channelId: string): string =>
  `${workspaceId}::${channelId}`

type ComposerAttachmentsState = {
  byKey: Record<string, ComposerAttachment[]>
  removedPersistedByKey: Record<string, string[]>
  setAttachments: (
    key: string,
    next: ComposerAttachment[] | ((prev: ComposerAttachment[]) => ComposerAttachment[])
  ) => void
  clearAttachmentsForKey: (key: string) => void
  takeRemovedPersistedPaths: (key: string) => string[]
  pushRemovedPersistedPath: (key: string, path: string) => void
  resetRemovedPersistedPaths: (key: string) => void
  pruneExceptKey: (keepKey: string) => void
}

export const useComposerAttachmentsStore = create<ComposerAttachmentsState>((set, get) => ({
  byKey: {},
  removedPersistedByKey: {},

  setAttachments: (key, next) => {
    set((state) => {
      const prev = state.byKey[key] ?? []
      const resolved = typeof next === 'function' ? next(prev) : next
      return { byKey: { ...state.byKey, [key]: resolved } }
    })
  },

  clearAttachmentsForKey: (key) => {
    set((state) => {
      const nextByKey = { ...state.byKey }
      delete nextByKey[key]
      const nextRemoved = { ...state.removedPersistedByKey }
      delete nextRemoved[key]
      return { byKey: nextByKey, removedPersistedByKey: nextRemoved }
    })
  },

  takeRemovedPersistedPaths: (key) => {
    const paths = get().removedPersistedByKey[key] ?? []
    if (paths.length === 0) return []
    set((state) => ({
      removedPersistedByKey: { ...state.removedPersistedByKey, [key]: [] }
    }))
    return paths
  },

  pushRemovedPersistedPath: (key, path) => {
    set((state) => ({
      removedPersistedByKey: {
        ...state.removedPersistedByKey,
        [key]: [...(state.removedPersistedByKey[key] ?? []), path]
      }
    }))
  },

  resetRemovedPersistedPaths: (key) => {
    set((state) => ({
      removedPersistedByKey: { ...state.removedPersistedByKey, [key]: [] }
    }))
  },

  pruneExceptKey: (keepKey) => {
    set((state) => ({
      byKey: state.byKey[keepKey] ? { [keepKey]: state.byKey[keepKey]! } : {},
      removedPersistedByKey: state.removedPersistedByKey[keepKey]
        ? { [keepKey]: state.removedPersistedByKey[keepKey]! }
        : {}
    }))
  }
}))

export const deleteNonPersistedAttachmentStorage = (attachments: ComposerAttachment[]) => {
  for (const attachment of attachments) {
    if (attachment.item && attachment.status === 'ready' && !attachment.persisted) {
      void deleteChatMediaFromStorage(attachment.item)
    }
  }
}

export const disposeComposerAttachmentsForKey = (
  key: string,
  options?: { deleteStorage?: boolean }
) => {
  const deleteStorage = options?.deleteStorage ?? true
  const state = useComposerAttachmentsStore.getState()
  const attachments = state.byKey[key] ?? []

  if (deleteStorage) deleteNonPersistedAttachmentStorage(attachments)

  state.clearAttachmentsForKey(key)
}
