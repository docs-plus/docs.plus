import type { ComposerAttachment } from '@components/chatroom/stores/composerAttachmentsStore'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import type { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory, MessageMediaItem } from '@types'
import { useEffect } from 'react'

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
  discardModeAttachments: () => void
  loadExistingAttachments: (items: MessageMediaItem[]) => void
  cancelEditAttachments: () => void
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
  discardModeAttachments,
  loadExistingAttachments,
  cancelEditAttachments,
  draftHydrated,
  replyMessageMemory,
  editMessageMemory,
  commentMessageMemory,
  isMobile
}: Args) => {
  // A comment shows the saved draft tiles, but its files never enter the saved draft.
  useComposerAttachmentDraft({
    workspaceId,
    channelId,
    editor,
    attachments,
    draftHydrated,
    skipHydrate: Boolean(editMessageMemory || replyMessageMemory),
    skipWrite: Boolean(editMessageMemory || replyMessageMemory || commentMessageMemory),
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

  // Also runs at mount: the desktop Close chatroom clears every mode and unmounts in one tick.
  useEffect(() => {
    if (replyMessageMemory || commentMessageMemory) return
    discardModeAttachments()
  }, [replyMessageMemory, commentMessageMemory, discardModeAttachments])

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

  const isComment = Boolean(commentMessageMemory)

  // Set on the live host, not through `editorProps`: the editor is built once per mount.
  useEffect(() => {
    const host = editorRef.current?.querySelector('.ProseMirror')
    if (!(host instanceof HTMLElement)) return
    host.setAttribute('inputmode', 'text')
    host.setAttribute('enterkeyhint', isMobile ? 'enter' : 'send')
    host.setAttribute('aria-label', isComment ? 'Add a comment' : 'Write a message')
  }, [editor, editorRef, isMobile, isComment])
}
