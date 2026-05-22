import { sendCommentMessage, updateMessage } from '@api'
import type { SendDraft } from '@components/chatroom/hooks/useSendMessage'
import { openComposerSignIn } from '@components/chatroom/utils/openComposerSignIn'
import { showNotificationPrompt } from '@components/NotificationPromptCard'
import * as toast from '@components/toast'
import { discardComposerDraft } from '@db/messageComposerDB'
import { useApi } from '@hooks/useApi'
import type { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory } from '@types'
import { chunkHtmlContent } from '@utils/chunkHtmlContent'
import { sanitizeChunk, sanitizeMessageContent } from '@utils/sanitizeContent'
import { useCallback } from 'react'

import { useComposerEmojiPanelStore } from '../stores/composerEmojiPanelStore'
import { isComposerLinkDialogOpen } from '../stores/composerLinkDialogStore'

export type ComposerSubmitArgs = {
  channelId: string
  workspaceId?: string
  user: { id?: string } | null
  editor: Editor | null
  contextSend: (draft: SendDraft) => Promise<void>
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

  // editor.getText() is authoritative — strips marks/whitespace already.
  const isSubmittable = useCallback(() => {
    if (!user || !editor) return false
    return editor.getText().trim() !== ''
  }, [user, editor])

  const cleanupAfterSubmit = useCallback(() => {
    if (replyMessageMemory) setReplyMsgMemory(channelId, null)
    if (editMessageMemory) setEditMsgMemory(channelId, null)
    if (commentMessageMemory) setCommentMsgMemory(channelId, null)

    cancelPendingEditorDraftCapture()
    if (workspaceId && channelId) void discardComposerDraft(workspaceId, channelId)

    // Panel-open ⇒ editor was intentionally blurred to show the picker;
    // refocusing would reopen the iOS keyboard and yank the panel away.
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

      let sanitizedHtml: string
      let sanitizedText: string
      let htmlChunks: string[]
      let textChunks: string[]

      try {
        const html = editor.getHTML()
        const text = editor.getText()
        const sanitized = sanitizeMessageContent(html, text)
        if (!sanitized.sanitizedHtml || !sanitized.sanitizedText) {
          throw new Error('Invalid content detected')
        }
        sanitizedHtml = sanitized.sanitizedHtml
        sanitizedText = sanitized.sanitizedText
        const chunks = chunkHtmlContent(sanitizedHtml, 3000)
        htmlChunks = chunks.htmlChunks
        textChunks = chunks.textChunks
      } catch (error: unknown) {
        toast.Error(error instanceof Error ? error.message : 'Invalid content')
        return
      }

      const usesOptimisticFeed =
        htmlChunks.length === 0 && !editMessageMemory && !commentMessageMemory
      const replyToId = editMessageMemory?.id ?? replyMessageMemory?.id ?? null

      const dispatchContent = async (content: string, html: string) => {
        if (editMessageMemory) {
          await updateMsg(content, html, editMessageMemory.id!)
        } else if (commentMessageMemory) {
          await sendComment(content, channelId, user.id!, html, {
            content: commentMessageMemory.content,
            html: commentMessageMemory.html,
            heading_id: commentMessageMemory.channel_id
          })
        } else {
          await contextSend({
            content,
            html,
            reply_to_message_id: replyToId
          })
        }
      }

      if (usesOptimisticFeed) cleanupAfterSubmit()

      try {
        if (htmlChunks.length === 0) {
          await dispatchContent(sanitizedText, sanitizedHtml)
        } else {
          for (const [index, htmlChunk] of htmlChunks.entries()) {
            const textChunk = textChunks[index]
            const { sanitizedHtmlChunk, sanitizedTextChunk } = sanitizeChunk(htmlChunk, textChunk)
            await dispatchContent(sanitizedTextChunk, sanitizedHtmlChunk)
          }
        }
      } catch (error: unknown) {
        toast.Error(error instanceof Error ? error.message : 'Failed to send')
        return
      }

      if (!usesOptimisticFeed) cleanupAfterSubmit()
      showNotificationPrompt()
    },
    [
      user,
      channelId,
      editor,
      isSubmittable,
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
