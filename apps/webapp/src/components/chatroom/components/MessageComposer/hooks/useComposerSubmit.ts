import { sendCommentMessage, updateMessage } from '@api'
import {
  composerAttachmentKey,
  useComposerAttachmentsStore
} from '@components/chatroom/stores/composerAttachmentsStore'
import type { SendDraft, SendResult } from '@components/chatroom/types/send.types'
import { composerSendGate } from '@components/chatroom/utils/composerSendGate'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import {
  dispatchOutboundChunk,
  ensureOutboundStorageReady,
  isAlreadyCapturedError,
  isFailedRowError,
  prepareOutboundContent
} from '@components/chatroom/utils/outboundMessagePipeline'
import { showNotificationPrompt } from '@components/NotificationPromptCard'
import * as toast from '@components/toast'
import {
  discardComposerDraft,
  flushPendingWrites,
  getComposerState,
  setComposerState
} from '@db/messageComposerDB'
import { useApi } from '@hooks/useApi'
import { useChatStore } from '@stores'
import type { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory, MessageMediaItem } from '@types'
import { captureUnknown } from '@utils/observability'
import { sanitizeChunk } from '@utils/sanitizeContent'
import { useCallback, useRef } from 'react'

import { useComposerEmojiPanelStore } from '../stores/composerEmojiPanelStore'
import { isComposerLinkDialogOpen } from '../stores/composerLinkDialogStore'

export type ComposerSubmitArgs = {
  channelId: string
  workspaceId?: string
  user: { id?: string } | null
  editor: Editor | null
  contextSend: (draft: SendDraft) => Promise<SendResult>
  getReadyAttachments: () => MessageMediaItem[]
  clearAttachments: () => void
  releaseSentAttachments: (sent: MessageMediaItem[]) => () => void
  flushRemovedPersistedStorage: () => void
  isUploadingAttachments?: boolean
  hasUploadErrors?: boolean
  replyMessageMemory: ComposerMessageMemory | null | undefined
  editMessageMemory: ComposerMessageMemory | null | undefined
  commentMessageMemory: CommentMessageMemory | null | undefined
  setReplyMsgMemory: (channelId: string, value: null) => void
  setEditMsgMemory: (channelId: string, value: null) => void
  setCommentMsgMemory: (channelId: string, value: CommentMessageMemory | null) => void
  cancelPendingEditorDraftCapture: () => void
  keepKeyboardAfterSubmit?: boolean
}

// The submit closure holds the modes of the render that began the send, so read the store.
const isComposerUntouched = (editor: Editor, channelId: string): boolean => {
  const memory = useChatStore.getState().workspaceSettings.channels.get(channelId)
  return (
    !editor.isDestroyed &&
    editor.isEmpty &&
    !memory?.replyMessageMemory &&
    !memory?.editMessageMemory &&
    !memory?.commentMessageMemory
  )
}

export const useComposerSubmit = ({
  channelId,
  workspaceId,
  user,
  editor,
  contextSend,
  getReadyAttachments,
  clearAttachments,
  releaseSentAttachments,
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
  const probingRef = useRef(false)

  const isSubmittable = useCallback(() => {
    if (!user || !editor) return false
    return composerSendGate({
      text: editor.getText(),
      readyAttachmentCount: getReadyAttachments().length,
      isUploading: isUploadingAttachments,
      hasUploadErrors
    })
  }, [user, editor, isUploadingAttachments, hasUploadErrors, getReadyAttachments])

  const cleanupAfterSubmit = useCallback(() => {
    if (replyMessageMemory) setReplyMsgMemory(channelId, null)
    if (editMessageMemory) setEditMsgMemory(channelId, null)
    if (commentMessageMemory) setCommentMsgMemory(channelId, null)

    cancelPendingEditorDraftCapture()
    // An edit save keeps the saved draft, and the end of the edit loads it back.
    if (workspaceId && channelId && !editMessageMemory) {
      void discardComposerDraft(workspaceId, channelId)
    }

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
      if (!isSubmittable() || !editor || probingRef.current) return

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

      const clearEarly = prepared.shouldClearComposerEarly
      // The early clear deletes the saved draft, so a failed comment writes it back for a cancel.
      let savedDraftRead: ReturnType<typeof getComposerState> | null = null
      if (clearEarly && prepared.mode.kind === 'comment' && workspaceId) {
        // A keystroke from just before the comment began may still sit in the debounce.
        flushPendingWrites()
        savedDraftRead = getComposerState(workspaceId, channelId)
      }

      // The composer clears only after the probe, so a second press here would send a second copy.
      probingRef.current = true
      const [storageReady, savedDraft] = await Promise.all([
        ensureOutboundStorageReady(prepared),
        savedDraftRead
      ]).finally(() => {
        probingRef.current = false
      })
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

      const unsentHtml = clearEarly ? editor.getHTML() : ''
      // The early clear ends comment mode, which empties the record of the files the comment added.
      // A restored comment records them again, so a later cancel still deletes their uploads.
      const draftKey = composerAttachmentKey(workspaceId, channelId)
      const { modeAddedByKey, pushModeAddedId } = useComposerAttachmentsStore.getState()
      const unsentModeAddedIds = modeAddedByKey[draftKey] ?? []
      // Release before the clear, so the sent files leave the draft list first. The clear ends a
      // reply or comment, which deletes the uploads that the mode added. It also fires the text
      // writer, which saves the draft list as the saved draft.
      const restoreAttachments =
        clearEarly && prepared.hasAttachments ? releaseSentAttachments(readyMedias) : null
      // An edit or comment started during the probe owns the editor now, so leave it alone.
      if (clearEarly) {
        const live = useChatStore.getState().workspaceSettings.channels.get(channelId)
        const modeChanged =
          (live?.editMessageMemory ?? null) !== (editMessageMemory ?? null) ||
          (live?.commentMessageMemory ?? null) !== (commentMessageMemory ?? null)
        if (!modeChanged) cleanupAfterSubmit()
        else if (workspaceId && !editMessageMemory)
          void discardComposerDraft(workspaceId, channelId)
      }

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
        // A failed row keeps the media for Retry and Delete. With no row, an untouched composer
        // takes back the sent media, and a comment's text and mode.
        if (!isFailedRowError(error) && clearEarly && isComposerUntouched(editor, channelId)) {
          restoreAttachments?.()
          if (prepared.mode.kind === 'comment') {
            setCommentMsgMemory(channelId, prepared.mode.commentMemory)
            editor.commands.setContent(unsentHtml)
            for (const id of unsentModeAddedIds) pushModeAddedId(draftKey, id)
            if (savedDraft && workspaceId) void setComposerState(workspaceId, channelId, savedDraft)
          }
        }
        toast.Error(error instanceof Error ? error.message : 'Failed to send')
        return
      }

      if (prepared.hasAttachments && !clearEarly) clearAttachments()
      if (!clearEarly) cleanupAfterSubmit()
      showNotificationPrompt()
    },
    [
      user,
      channelId,
      workspaceId,
      editor,
      isSubmittable,
      getReadyAttachments,
      clearAttachments,
      releaseSentAttachments,
      flushRemovedPersistedStorage,
      cleanupAfterSubmit,
      editMessageMemory,
      commentMessageMemory,
      replyMessageMemory,
      updateMsg,
      sendComment,
      contextSend,
      setCommentMsgMemory
    ]
  )

  return { submitMessage }
}
