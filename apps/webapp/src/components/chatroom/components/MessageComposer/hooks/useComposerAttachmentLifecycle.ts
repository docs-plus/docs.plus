import type { ComposerAttachment } from '@components/chatroom/stores/composerAttachmentsStore'
import { parseMessageMedias } from '@components/chatroom/utils/messageMediaPaths'
import type { Editor } from '@tiptap/react'
import type { ComposerMessageMemory, MessageMediaItem } from '@types'
import { useEffect } from 'react'

import type { ComposerModeEdge } from '../types'
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
  editMessageMemory: ComposerMessageMemory | null | undefined
  modeEdge: ComposerModeEdge
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
  editMessageMemory,
  modeEdge,
  isMobile
}: Args) => {
  // A comment shows the saved draft tiles, but its files never enter the saved draft.
  useComposerAttachmentDraft({
    workspaceId,
    channelId,
    editor,
    attachments,
    draftHydrated,
    skipHydrate: modeEdge.to === 'edit' || modeEdge.to === 'reply',
    skipWrite: modeEdge.to !== 'none',
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

  useEffect(() => {
    if (modeEdge.discardModeAdded) discardModeAttachments()
  }, [modeEdge, discardModeAttachments])

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

  const isComment = modeEdge.to === 'comment'

  // Set on the live host, not through `editorProps`: the editor is built once per mount.
  useEffect(() => {
    const host = editorRef.current?.querySelector('.ProseMirror')
    if (!(host instanceof HTMLElement)) return
    host.setAttribute('inputmode', 'text')
    host.setAttribute('enterkeyhint', isMobile ? 'enter' : 'send')
    host.setAttribute('aria-label', isComment ? 'Add a comment' : 'Write a message')
  }, [editor, editorRef, isMobile, isComment])
}
