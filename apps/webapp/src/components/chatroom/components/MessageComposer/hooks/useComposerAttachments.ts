import {
  composerAttachmentKey,
  deleteNonPersistedAttachmentStorage,
  disposeComposerAttachmentsForKey,
  useComposerAttachmentsStore
} from '@components/chatroom/stores/composerAttachmentsStore'
import { validateChatMediaFile } from '@components/chatroom/utils/chatMediaMime'
import { ChatMediaUploadRunner } from '@components/chatroom/utils/chatMediaUploadRunner'
import { CHAT_MEDIA_MAX_ATTACHMENTS } from '@components/chatroom/utils/messageMediaPaths'
import { deleteChatMediaFromStorage } from '@components/chatroom/utils/uploadChatMedia'
import * as toast from '@components/toast'
import type { MessageMediaItem } from '@types'
import { useCallback, useEffect, useMemo, useRef } from 'react'

export type { ComposerAttachment } from '@components/chatroom/stores/composerAttachmentsStore'

type Args = {
  workspaceId?: string
  channelId: string
  userId: string | undefined
  disabled?: boolean
}

export const useComposerAttachments = ({
  workspaceId,
  channelId,
  userId,
  disabled = false
}: Args) => {
  const storeKey = workspaceId ? composerAttachmentKey(workspaceId, channelId) : channelId
  const attachments = useComposerAttachmentsStore((state) => state.byKey[storeKey] ?? [])
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
  const pruneExceptKey = useComposerAttachmentsStore((state) => state.pruneExceptKey)

  const uploadRunnerRef = useRef<ChatMediaUploadRunner | null>(null)
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments

  useEffect(() => {
    if (!userId) return
    const runner = new ChatMediaUploadRunner({
      userId,
      channelId,
      setAttachments: (next) => setAttachments(storeKey, next)
    })
    uploadRunnerRef.current = runner
    return () => {
      runner.dispose()
      uploadRunnerRef.current = null
    }
  }, [channelId, setAttachments, storeKey, userId])

  const removeAttachment = useCallback(
    (id: string) => {
      const attachment = attachmentsRef.current.find((entry) => entry.id === id)
      if (attachment) {
        uploadRunnerRef.current?.deleteReadyAttachment(attachment, (path) =>
          pushRemovedPersistedPath(storeKey, path)
        )
      }
      setAttachments(storeKey, (prev) => prev.filter((entry) => entry.id !== id))
    },
    [pushRemovedPersistedPath, setAttachments, storeKey]
  )

  const clearAttachments = useCallback(
    (options?: { deleteStorage?: boolean }) => {
      const deleteStorage = options?.deleteStorage ?? true
      if (deleteStorage) deleteNonPersistedAttachmentStorage(attachmentsRef.current)
      uploadRunnerRef.current?.reset()
      resetRemovedPersistedPaths(storeKey)
      setAttachments(storeKey, [])
    },
    [resetRemovedPersistedPaths, setAttachments, storeKey]
  )

  const resetAttachmentUi = useCallback(() => {
    uploadRunnerRef.current?.reset()
    resetRemovedPersistedPaths(storeKey)
    setAttachments(storeKey, [])
  }, [resetRemovedPersistedPaths, setAttachments, storeKey])

  const cancelEditAttachments = useCallback(() => {
    deleteNonPersistedAttachmentStorage(attachmentsRef.current)
    resetAttachmentUi()
  }, [resetAttachmentUi])

  useEffect(() => {
    const staleKeys = Object.keys(useComposerAttachmentsStore.getState().byKey).filter(
      (key) => key !== storeKey
    )
    for (const key of staleKeys) {
      disposeComposerAttachmentsForKey(key)
    }

    pruneExceptKey(storeKey)
    uploadRunnerRef.current?.reset()
    resetRemovedPersistedPaths(storeKey)
  }, [channelId, workspaceId, pruneExceptKey, resetRemovedPersistedPaths, storeKey])

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      if (disabled || !userId || !uploadRunnerRef.current) return

      const incoming = Array.from(files)
      const slotsLeft = CHAT_MEDIA_MAX_ATTACHMENTS - attachmentsRef.current.length
      if (slotsLeft <= 0) {
        toast.Error(`Maximum ${CHAT_MEDIA_MAX_ATTACHMENTS} attachments per message`)
        return
      }
      if (incoming.length > slotsLeft) {
        toast.Error(
          `Only ${slotsLeft} more attachment${slotsLeft === 1 ? '' : 's'} can be added (max ${CHAT_MEDIA_MAX_ATTACHMENTS})`
        )
      }

      for (const file of incoming.slice(0, slotsLeft)) {
        const validationError = validateChatMediaFile(file)
        if (validationError) {
          toast.Error(validationError)
          continue
        }
        uploadRunnerRef.current.enqueue(crypto.randomUUID(), file)
      }
    },
    [disabled, userId]
  )

  const loadExistingAttachments = useCallback(
    (items: MessageMediaItem[]) => {
      uploadRunnerRef.current?.reset()
      resetRemovedPersistedPaths(storeKey)
      setAttachments(
        storeKey,
        items.map((item) => ({
          id: crypto.randomUUID(),
          item,
          status: 'ready' as const,
          persisted: true,
          spoiler: item.spoiler
        }))
      )
    },
    [resetRemovedPersistedPaths, setAttachments, storeKey]
  )

  const flushRemovedPersistedStorage = useCallback(() => {
    for (const path of takeRemovedPersistedPaths(storeKey)) {
      void deleteChatMediaFromStorage({ url: path, path, type: 'file' })
    }
  }, [storeKey, takeRemovedPersistedPaths])

  const retryAttachment = useCallback(
    (id: string) => {
      if (disabled || !userId || !uploadRunnerRef.current) return

      const attachment = attachmentsRef.current.find((entry) => entry.id === id)
      if (!attachment?.file || attachment.status !== 'error') return

      uploadRunnerRef.current.enqueue(id, attachment.file)
    },
    [disabled, userId]
  )

  const hasReadyAttachments = useMemo(
    () => attachments.some((attachment) => attachment.status === 'ready' && attachment.item),
    [attachments]
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
      setAttachments(storeKey, (prev) =>
        prev.map((attachment) =>
          attachment.id === id ? { ...attachment, spoiler: !attachment.spoiler } : attachment
        )
      )
    },
    [setAttachments, storeKey]
  )

  return {
    attachments,
    addFiles,
    removeAttachment,
    retryAttachment,
    clearAttachments,
    loadExistingAttachments,
    flushRemovedPersistedStorage,
    cancelEditAttachments,
    hasReadyAttachments,
    hasUploadErrors,
    isUploading,
    readyAttachmentCount,
    getReadyAttachments,
    toggleAttachmentSpoiler,
    storeKey
  }
}
