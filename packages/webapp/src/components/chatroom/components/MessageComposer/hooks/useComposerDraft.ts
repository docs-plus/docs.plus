import { ComposerState, getComposerState } from '@db/messageComposerDB'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/react'
import type { CommentMessageMemory, ComposerMessageMemory } from '@types'
import { isOnlyEmoji } from '@utils/emojis'
import { useEffect } from 'react'

export type ComposerDraftArgs = {
  editor: Editor | null
  workspaceId?: string
  channelId: string
  editMessageMemory: ComposerMessageMemory | null | undefined
  replyMessageMemory: ComposerMessageMemory | null | undefined
  commentMessageMemory: CommentMessageMemory | null | undefined
  setIsEmojiOnly: (value: boolean) => void
  setDraftHydrated: (hydrated: boolean) => void
}

export const useComposerDraft = ({
  editor,
  workspaceId,
  channelId,
  editMessageMemory,
  replyMessageMemory,
  commentMessageMemory,
  setIsEmojiOnly,
  setDraftHydrated
}: ComposerDraftArgs) => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)

  useEffect(() => {
    if (!editor || !workspaceId || !channelId) {
      setDraftHydrated(false)
      return
    }
    if (editMessageMemory || replyMessageMemory || commentMessageMemory) {
      setDraftHydrated(true)
      return
    }

    setDraftHydrated(false)
    let cancelled = false
    getComposerState(workspaceId, channelId)
      .then((draft: ComposerState | null) => {
        if (cancelled) return
        const hasDraft = Boolean(draft?.text?.trim() || draft?.html?.trim())
        if (!hasDraft) return
        if (draft?.html) {
          if (isMobile) editor.commands.setContent(draft.html)
          else editor.chain().setContent(draft.html).focus('end').run()
        } else if (draft?.text) {
          if (isMobile) editor.commands.setContent(draft.text)
          else editor.chain().setContent(draft.text).focus('end').run()
        }
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
    editMessageMemory,
    replyMessageMemory,
    commentMessageMemory,
    setIsEmojiOnly,
    setDraftHydrated,
    isMobile
  ])

  useEffect(() => {
    if (!editor || !editMessageMemory || editMessageMemory.channel_id !== channelId) return
    const content = editMessageMemory.html || editMessageMemory.content
    if (!content) return
    if (isMobile) editor.commands.setContent(content)
    else editor.chain().setContent(content).focus('start').run()
  }, [editor, editMessageMemory, channelId, isMobile])
}
