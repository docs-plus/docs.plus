import { sendCommentMessage, updateMessage } from '@api'
import type { SendDraft, SendResult } from '@components/chatroom/types/send.types'
import { composerSendGate } from '@components/chatroom/utils/composerSendGate'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import {
  dispatchOutboundChunk,
  ensureOutboundStorageReady,
  isAlreadyCapturedError,
  prepareOutboundContent
} from '@components/chatroom/utils/outboundMessagePipeline'
import { showNotificationPrompt } from '@components/NotificationPromptCard'
import * as toast from '@components/toast'
import { discardComposerDraft } from '@db/messageComposerDB'
import { useApi } from '@hooks/useApi'
import type { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory, MessageMediaItem } from '@types'
import { captureUnknown } from '@utils/observability'
import { sanitizeChunk } from '@utils/sanitizeContent'
import { useCallback } from 'react'

import { useComposerEmojiPanelStore } from '../stores/composerEmojiPanelStore'
import { isComposerLinkDialogOpen } from '../stores/composerLinkDialogStore'

export type ComposerSubmitArgs = {
  channelId: string
  workspaceId?: string
  user: { id?: string } | null
  editor: Editor | null
  contextSend: (draft: SendDraft) => Promise<SendResult>
  getReadyAttachments: () => MessageMediaItem[]
  clearAttachments: (options?: { deleteStorage?: boolean }) => void
  flushRemovedPersistedStorage: () => void
  isUploadingAttachments?: boolean
  hasUploadErrors?: boolean
  replyMessageMemory: ComposerMessageMemory | null | undefined
  editMessageMemory: ComposerMessageMemory | null | undefined
  commentMessageMemory: CommentMessageMemory | null | undefined
  setReplyMsgMemory: (channelId: string, value: null) => void
  setEditMsgMemory: (channelId: string, value: null) => void
  setCommentMsgMemory: (channelId: string, value: null) => void
  cancelPendingEditorDraftCapture: () => void
  keepKeyboardAfterSubmit?: boolean
}

export const useComposerSubmit = ({
  channelId,
  workspaceId,
  user,
  editor,
  contextSend,
  getReadyAttachments,
  clearAttachments,
  flushRemovedPersistedStorage,
  isUploadingAttachments = false,
  hasUploadErrors = false,
  replyMessageMemory,
  editMessageMemory,
  commentMessageMemory,
  setReplyMsgMemory,
  setEditMsgMemory,
  setCommentMsgMemory,
  cancelPendingEditorDraftCapture,
  keepKeyboardAfterSubmit = false
}: ComposerSubmitArgs) => {
  const { request: updateMsg } = useApi(updateMessage, null, false)
  const { request: sendComment } = useApi(sendCommentMessage, null, false)

  const isSubmittable = useCallback(() => {
    if (!user || !editor) return false
    return composerSendGate({
      text: editor.getText(),
      readyAttachmentCount: getReadyAttachments().length,
      editMessageMemory,
      isUploading: isUploadingAttachments,
      hasUploadErrors
    })
  }, [
    user,
    editor,
    isUploadingAttachments,
    hasUploadErrors,
    getReadyAttachments,
    editMessageMemory
  ])

  const cleanupAfterSubmit = useCallback(() => {
    if (replyMessageMemory) setReplyMsgMemory(channelId, null)
    if (editMessageMemory) setEditMsgMemory(channelId, null)
    if (commentMessageMemory) setCommentMsgMemory(channelId, null)

    cancelPendingEditorDraftCapture()
    if (workspaceId && channelId) void discardComposerDraft(workspaceId, channelId)

    const panelOpen = useComposerEmojiPanelStore.getState().isOpen
    const linkDialogOpen = isComposerLinkDialogOpen()
    const shouldRefocus =
      !panelOpen &&
      !linkDialogOpen &&
      (keepKeyboardAfterSubmit ||
        (editor != null && editor.view.dom.contains(document.activeElement)))

    if (shouldRefocus) editor?.chain().clearContent(true).focus('start').run()
    else editor?.chain().clearContent(true).run()
  }, [
    editor,
    replyMessageMemory,
    editMessageMemory,
    commentMessageMemory,
    channelId,
    workspaceId,
    setReplyMsgMemory,
    setEditMsgMemory,
    setCommentMsgMemory,
    cancelPendingEditorDraftCapture,
    keepKeyboardAfterSubmit
  ])

  const submitMessage = useCallback(
    async (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.()

      if (!user) {
        openComposerSignIn(channelId)
        return
      }
      if (!isSubmittable() || !editor) return

      const readyMedias = getReadyAttachments()
      const replyToId = editMessageMemory?.id ?? replyMessageMemory?.id ?? null
      const prepared = prepareOutboundContent(
        editor,
        readyMedias,
        editMessageMemory,
        commentMessageMemory,
        replyToId
      )

      if (!prepared.ok) {
        toast.Error(prepared.error)
        return
      }

      const storageReady = await ensureOutboundStorageReady(prepared)
      if (!storageReady) {
        toast.Error('Attachments are still uploading. Wait a moment and try again.')
        return
      }

      const dispatchChunk = async (content: string, html: string, chunkIndex: number) => {
        await dispatchOutboundChunk(prepared, content, html, chunkIndex, {
          channelId,
          userId: user.id!,
          contextSend,
          updateMsg,
          sendComment,
          flushRemovedPersistedStorage
        })
      }

      if (prepared.shouldClearComposerEarly) cleanupAfterSubmit()

      try {
        if (prepared.htmlChunks.length === 0) {
          await dispatchChunk(prepared.sanitizedText, prepared.sanitizedHtml, 0)
        } else {
          for (const [index, htmlChunk] of prepared.htmlChunks.entries()) {
            const textChunk = prepared.textChunks[index] ?? ''
            const { sanitizedHtmlChunk, sanitizedTextChunk } = sanitizeChunk(htmlChunk, textChunk)
            await dispatchChunk(sanitizedTextChunk, sanitizedHtmlChunk, index)
          }
        }
      } catch (error: unknown) {
        // Edit/comment failures are only surfaced here; direct-send wrappers were
        // already captured inside persistChatMessage.
        if (!isAlreadyCapturedError(error)) {
          captureUnknown(error, { tags: { surface: 'chat-send' } })
        }
        toast.Error(error instanceof Error ? error.message : 'Failed to send')
        return
      }

      if (prepared.hasAttachments) clearAttachments({ deleteStorage: false })
      if (!prepared.shouldClearComposerEarly) cleanupAfterSubmit()
      showNotificationPrompt()
    },
    [
      user,
      channelId,
      editor,
      isSubmittable,
      getReadyAttachments,
      clearAttachments,
      flushRemovedPersistedStorage,
      cleanupAfterSubmit,
      editMessageMemory,
      commentMessageMemory,
      replyMessageMemory,
      updateMsg,
      sendComment,
      contextSend
    ]
  )

  return { submitMessage }
}
