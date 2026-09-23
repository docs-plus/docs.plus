import {
  type ComposerAttachment,
  composerAttachmentKey,
  composerEditAttachmentKey,
  deleteNonPersistedAttachmentStorage,
  selectComposerAttachmentsByKey,
  useComposerAttachmentsStore
} from '@components/chatroom/stores/composerAttachmentsStore'
import { validateChatMediaFile } from '@components/chatroom/utils/chatMediaMime'
import {
  ChatMediaUploadRunner,
  isDownscalableChatImage
} from '@components/chatroom/utils/chatMediaUploadRunner'
import {
  CHAT_MEDIA_MAX_ATTACHMENTS,
  CHAT_MEDIA_MAX_BYTES,
  mediaStoragePath
} from '@components/chatroom/utils/messageMediaPaths'
import {
  CHAT_MEDIA_TOO_LARGE_ERROR,
  deleteChatMediaFromStorage
} from '@components/chatroom/utils/uploadChatMedia'
import * as toast from '@components/toast'
import { useChatStore } from '@stores'
import type { MessageMediaItem } from '@types'
import { useCallback, useEffect, useMemo, useRef } from 'react'

export type { ComposerAttachment } from '@components/chatroom/stores/composerAttachmentsStore'

type Args = {
  workspaceId?: string
  channelId: string
  userId: string | undefined
}

export const useComposerAttachments = ({ workspaceId, channelId, userId }: Args) => {
  const draftKey = composerAttachmentKey(workspaceId, channelId)
  const editKey = composerEditAttachmentKey(draftKey)
  const editing = useChatStore((state) =>
    Boolean(state.workspaceSettings.channels.get(channelId)?.editMessageMemory)
  )
  const activeKey = editing ? editKey : draftKey
  const attachments = useComposerAttachmentsStore(selectComposerAttachmentsByKey(activeKey))
  const setAttachments = useComposerAttachmentsStore((state) => state.setAttachments)
  const pushRemovedPersistedPath = useComposerAttachmentsStore(
    (state) => state.pushRemovedPersistedPath
  )
  const takeRemovedPersistedPaths = useComposerAttachmentsStore(
    (state) => state.takeRemovedPersistedPaths
  )
  const resetRemovedPersistedPaths = useComposerAttachmentsStore(
    (state) => state.resetRemovedPersistedPaths
  )
  const pushModeAddedId = useComposerAttachmentsStore((state) => state.pushModeAddedId)
  const takeModeAddedIds = useComposerAttachmentsStore((state) => state.takeModeAddedIds)
  const pruneExceptKeys = useComposerAttachmentsStore((state) => state.pruneExceptKeys)

  const draftRunnerRef = useRef<ChatMediaUploadRunner | null>(null)
  const editRunnerRef = useRef<ChatMediaUploadRunner | null>(null)
  const activeRunnerRef = editing ? editRunnerRef : draftRunnerRef
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments

  // Keep `editing` out of the deps: a re-run disposes the draft runner and stops its uploads.
  useEffect(() => {
    if (!userId) return
    const runnerFor = (key: string) =>
      new ChatMediaUploadRunner({
        userId,
        channelId,
        setAttachments: (next) => setAttachments(key, next)
      })
    const draftRunner = runnerFor(draftKey)
    const editRunner = runnerFor(editKey)
    draftRunnerRef.current = draftRunner
    editRunnerRef.current = editRunner
    // The last mount's runner stopped these uploads, and nothing else can finish them.
    const draft = selectComposerAttachmentsByKey(draftKey)(useComposerAttachmentsStore.getState())
    for (const entry of draft) {
      if (entry.status === 'uploading' && entry.file) draftRunner.enqueue(entry.id, entry.file)
    }
    return () => {
      draftRunner.dispose()
      editRunner.dispose()
      draftRunnerRef.current = null
      editRunnerRef.current = null
    }
  }, [channelId, setAttachments, draftKey, editKey, userId])

  const removeAttachment = useCallback(
    (id: string) => {
      const attachment = attachmentsRef.current.find((entry) => entry.id === id)
      if (attachment) {
        activeRunnerRef.current?.deleteReadyAttachment(attachment, (path) =>
          pushRemovedPersistedPath(activeKey, path)
        )
      }
      setAttachments(activeKey, (prev) => prev.filter((entry) => entry.id !== id))
    },
    [activeKey, activeRunnerRef, pushRemovedPersistedPath, setAttachments]
  )

  const clearAttachments = useCallback(() => {
    activeRunnerRef.current?.reset()
    resetRemovedPersistedPaths(activeKey)
    setAttachments(activeKey, [])
  }, [activeKey, activeRunnerRef, resetRemovedPersistedPaths, setAttachments])

  // The outbound message owns these uploads now, so they leave the strip undeleted,
  // and the upload runner is not reset. The undo returns them to the list they left.
  const releaseSentAttachments = useCallback(
    (sent: MessageMediaItem[]) => {
      const key = activeKey
      const sentPaths = new Set(sent.map(mediaStoragePath))
      const isSent = (entry: ComposerAttachment) => {
        const path = entry.item ? mediaStoragePath(entry.item) : null
        return path != null && sentPaths.has(path)
      }
      let released: ComposerAttachment[] = []
      setAttachments(key, (prev) => {
        released = prev.filter(isSent)
        return released.length > 0 ? prev.filter((entry) => !isSent(entry)) : prev
      })
      return () => setAttachments(key, (prev) => [...released, ...prev])
    },
    [setAttachments, activeKey]
  )

  const discardModeAttachments = useCallback(() => {
    const ids = new Set(takeModeAddedIds(draftKey))
    if (ids.size === 0) return
    for (const id of ids) draftRunnerRef.current?.cancel(id)
    const draft = selectComposerAttachmentsByKey(draftKey)(useComposerAttachmentsStore.getState())
    deleteNonPersistedAttachmentStorage(draft.filter((entry) => ids.has(entry.id)))
    setAttachments(draftKey, (prev) => prev.filter((entry) => !ids.has(entry.id)))
  }, [draftKey, setAttachments, takeModeAddedIds])

  const cancelEditAttachments = useCallback(() => {
    deleteNonPersistedAttachmentStorage(
      selectComposerAttachmentsByKey(editKey)(useComposerAttachmentsStore.getState())
    )
    editRunnerRef.current?.reset()
    resetRemovedPersistedPaths(editKey)
    setAttachments(editKey, [])
  }, [editKey, resetRemovedPersistedPaths, setAttachments])

  useEffect(() => {
    pruneExceptKeys([draftKey, editKey])
  }, [draftKey, editKey, pruneExceptKeys])

  const addFiles = useCallback(
    (files: FileList | File[]): string[] => {
      const runner = activeRunnerRef.current
      if (!userId || !runner) return []

      const incoming = Array.from(files)
      const slotsLeft = CHAT_MEDIA_MAX_ATTACHMENTS - attachmentsRef.current.length
      if (slotsLeft <= 0) {
        toast.Error(`Maximum ${CHAT_MEDIA_MAX_ATTACHMENTS} attachments per message`)
        return []
      }
      if (incoming.length > slotsLeft) {
        toast.Error(
          `Only ${slotsLeft} more attachment${slotsLeft === 1 ? '' : 's'} can be added (max ${CHAT_MEDIA_MAX_ATTACHMENTS})`
        )
      }

      const memory = useChatStore.getState().workspaceSettings.channels.get(channelId)
      const addedInMode = Boolean(memory?.replyMessageMemory || memory?.commentMessageMemory)
      const ids: string[] = []
      for (const file of incoming.slice(0, slotsLeft)) {
        const validationError = validateChatMediaFile(file)
        if (validationError) {
          toast.Error(validationError)
          continue
        }
        // Only a downscaled image can shrink under the limit, so refuse any other large file now.
        if (file.size > CHAT_MEDIA_MAX_BYTES && !isDownscalableChatImage(file)) {
          toast.Error(CHAT_MEDIA_TOO_LARGE_ERROR)
          continue
        }
        const id = crypto.randomUUID()
        if (addedInMode) pushModeAddedId(draftKey, id)
        // The row exists before its upload starts, so a file queued behind others shows and counts.
        setAttachments(activeKey, (prev) => [
          ...prev,
          { id, file, status: 'uploading', progress: 0 }
        ])
        runner.enqueue(id, file)
        ids.push(id)
      }
      return ids
    },
    [activeKey, activeRunnerRef, channelId, draftKey, pushModeAddedId, setAttachments, userId]
  )

  const loadExistingAttachments = useCallback(
    (items: MessageMediaItem[]) => {
      editRunnerRef.current?.reset()
      resetRemovedPersistedPaths(editKey)
      setAttachments(
        editKey,
        items.map((item) => ({
          id: crypto.randomUUID(),
          item,
          status: 'ready' as const,
          persisted: true,
          spoiler: item.spoiler
        }))
      )
    },
    [editKey, resetRemovedPersistedPaths, setAttachments]
  )

  const flushRemovedPersistedStorage = useCallback(() => {
    for (const path of takeRemovedPersistedPaths(editKey)) {
      void deleteChatMediaFromStorage({ url: path, path, type: 'file' })
    }
  }, [editKey, takeRemovedPersistedPaths])

  const retryAttachment = useCallback(
    (id: string) => {
      const runner = activeRunnerRef.current
      if (!userId || !runner) return

      const attachment = attachmentsRef.current.find((entry) => entry.id === id)
      if (!attachment?.file || attachment.status !== 'error') return

      runner.enqueue(id, attachment.file)
    },
    [activeRunnerRef, userId]
  )

  const isUploading = useMemo(
    () => attachments.some((attachment) => attachment.status === 'uploading'),
    [attachments]
  )

  const hasUploadErrors = useMemo(
    () => attachments.some((attachment) => attachment.status === 'error'),
    [attachments]
  )

  const readyAttachmentCount = useMemo(
    () =>
      attachments.filter((attachment) => attachment.status === 'ready' && attachment.item).length,
    [attachments]
  )

  const getReadyAttachments = useCallback(
    (): MessageMediaItem[] =>
      attachments
        .filter((attachment) => attachment.status === 'ready' && attachment.item)
        .map((attachment) =>
          attachment.spoiler && attachment.item
            ? { ...attachment.item, spoiler: true }
            : attachment.item!
        ),
    [attachments]
  )

  const toggleAttachmentSpoiler = useCallback(
    (id: string) => {
      setAttachments(activeKey, (prev) =>
        prev.map((attachment) =>
          attachment.id === id ? { ...attachment, spoiler: !attachment.spoiler } : attachment
        )
      )
    },
    [activeKey, setAttachments]
  )

  return {
    attachments,
    addFiles,
    removeAttachment,
    retryAttachment,
    clearAttachments,
    releaseSentAttachments,
    discardModeAttachments,
    loadExistingAttachments,
    flushRemovedPersistedStorage,
    cancelEditAttachments,
    hasUploadErrors,
    isUploading,
    readyAttachmentCount,
    getReadyAttachments,
    toggleAttachmentSpoiler
  }
}
