import { getComposerState } from '@db/messageComposerDB'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory } from '@types'
import { isOnlyEmoji } from '@utils/emojis'
import { useEffect, useRef } from 'react'

export type ComposerDraftArgs = {
  editor: Editor | null
  workspaceId?: string
  channelId: string
  editMessageMemory: ComposerMessageMemory | null | undefined
  commentMessageMemory: CommentMessageMemory | null | undefined
  setIsEmojiOnly: (value: boolean) => void
  setDraftHydrated: (hydrated: boolean) => void
}

export const useComposerDraft = ({
  editor,
  workspaceId,
  channelId,
  editMessageMemory,
  commentMessageMemory,
  setIsEmojiOnly,
  setDraftHydrated
}: ComposerDraftArgs) => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)
  const isEditing = Boolean(editMessageMemory)
  const isCommenting = Boolean(commentMessageMemory)
  // Null until the first run with an editor, so a composer that mounts in comment mode loads the draft.
  const prevModeRef = useRef<{ isEditing: boolean; isCommenting: boolean } | null>(null)

  useEffect(() => {
    const prev = prevModeRef.current
    if (!editor || !workspaceId || !channelId) {
      setDraftHydrated(false)
      return
    }
    prevModeRef.current = { isEditing, isCommenting }
    // A comment that did not start from an edit keeps the editor, which can hold a restored comment.
    if (isEditing || (isCommenting && prev !== null && !prev.isEditing)) {
      setDraftHydrated(true)
      return
    }

    // The end of an edit or a comment replaces its text, even when the draft has no text.
    const endsMode = prev !== null && (prev.isEditing || prev.isCommenting)
    setDraftHydrated(false)
    let cancelled = false
    getComposerState(workspaceId, channelId)
      .then((draft) => {
        if (cancelled) return
        const content = draft?.html || draft?.text || ''
        if (!content && !endsMode) return
        if (isMobile) editor.commands.setContent(content)
        else editor.chain().setContent(content).focus('end').run()
        if (draft?.text && isOnlyEmoji(draft.text)) setIsEmojiOnly(true)
      })
      .finally(() => {
        if (!cancelled) setDraftHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [
    editor,
    workspaceId,
    channelId,
    isEditing,
    isCommenting,
    isMobile,
    setIsEmojiOnly,
    setDraftHydrated
  ])

  useEffect(() => {
    if (!editor || !editMessageMemory || editMessageMemory.channel_id !== channelId) return
    const content = editMessageMemory.html || editMessageMemory.content || ''
    if (isMobile) editor.commands.setContent(content)
    else editor.chain().setContent(content).focus('start').run()
  }, [editor, editMessageMemory, channelId, isMobile])
}
