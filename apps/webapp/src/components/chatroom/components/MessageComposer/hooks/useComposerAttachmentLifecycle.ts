import type { ComposerAttachment } from '@components/chatroom/stores/composerAttachmentsStore'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import type { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory, MessageMediaItem } from '@types'
import { useEffect, useRef } from 'react'

import {
  hydrateComposerAttachmentsFromDraft,
  useComposerAttachmentDraft
} from './useComposerAttachmentDraft'

type Args = {
  workspaceId?: string
  channelId: string
  userId: string | undefined
  editor: Editor | null
  editorRef: React.RefObject<HTMLDivElement | null>
  attachments: ComposerAttachment[]
  addFiles: (files: FileList | File[]) => void
  clearAttachments: (options?: { deleteStorage?: boolean }) => void
  loadExistingAttachments: (items: MessageMediaItem[]) => void
  cancelEditAttachments: () => void
  text: string
  html: string
  draftHydrated: boolean
  replyMessageMemory: ComposerMessageMemory | null | undefined
  editMessageMemory: ComposerMessageMemory | null | undefined
  commentMessageMemory: CommentMessageMemory | null | undefined
  isMobile: boolean
}

export const useComposerAttachmentLifecycle = ({
  workspaceId,
  channelId,
  userId,
  editor,
  editorRef,
  attachments,
  addFiles,
  clearAttachments,
  loadExistingAttachments,
  cancelEditAttachments,
  text,
  html,
  draftHydrated,
  replyMessageMemory,
  editMessageMemory,
  commentMessageMemory,
  isMobile
}: Args) => {
  const skipAttachmentDraft = Boolean(
    editMessageMemory || replyMessageMemory || commentMessageMemory
  )

  useComposerAttachmentDraft({
    workspaceId,
    channelId,
    attachments,
    draftText: text,
    draftHtml: html,
    draftHydrated,
    skipDraft: skipAttachmentDraft,
    onHydrateAttachments: (drafts) => {
      if (!workspaceId) return
      hydrateComposerAttachmentsFromDraft(workspaceId, channelId, drafts)
    }
  })

  useEffect(() => {
    if (!editMessageMemory || editMessageMemory.channel_id !== channelId) return
    loadExistingAttachments(parseMessageMedias(editMessageMemory.medias))
  }, [editMessageMemory, channelId, loadExistingAttachments])

  useEffect(() => {
    if (editMessageMemory) return
    cancelEditAttachments()
  }, [editMessageMemory, cancelEditAttachments])

  const hadReplyOrCommentRef = useRef(false)
  useEffect(() => {
    const inReplyOrComment = Boolean(replyMessageMemory || commentMessageMemory)
    if (hadReplyOrCommentRef.current && !inReplyOrComment) {
      clearAttachments({ deleteStorage: true })
    }
    hadReplyOrCommentRef.current = inReplyOrComment
  }, [replyMessageMemory, commentMessageMemory, clearAttachments])

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onPaste = (event: ClipboardEvent) => {
      if (!userId) return
      const files = event.clipboardData?.files
      if (!files?.length) return
      event.preventDefault()
      addFiles(files)
    }
    dom.addEventListener('paste', onPaste)
    return () => dom.removeEventListener('paste', onPaste)
  }, [addFiles, editor, userId])

  useEffect(() => {
    const host = editorRef.current?.querySelector('.ProseMirror')
    if (!(host instanceof HTMLElement)) return
    host.setAttribute('inputmode', 'text')
    host.setAttribute('enterkeyhint', isMobile ? 'enter' : 'send')
  }, [editor, editorRef, isMobile])
}
