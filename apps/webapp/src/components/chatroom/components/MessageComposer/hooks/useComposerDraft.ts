import { getComposerState } from '@db/messageComposerDB'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/react'
import type { ComposerMessageMemory } from '@types'
import { isOnlyEmoji } from '@utils/emojis'
import { useEffect } from 'react'

import type { ComposerModeEdge } from '../types'

export type ComposerDraftArgs = {
  editor: Editor | null
  workspaceId?: string
  channelId: string
  editMessageMemory: ComposerMessageMemory | null | undefined
  draftEdge: ComposerModeEdge
  setIsEmojiOnly: (value: boolean) => void
  setDraftHydrated: (hydrated: boolean) => void
}

export const useComposerDraft = ({
  editor,
  workspaceId,
  channelId,
  editMessageMemory,
  draftEdge,
  setIsEmojiOnly,
  setDraftHydrated
}: ComposerDraftArgs) => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)

  useEffect(() => {
    if (!editor || !workspaceId || !channelId) {
      setDraftHydrated(false)
      return
    }
    if (draftEdge.draftLoad === 'keep') {
      setDraftHydrated(true)
      return
    }

    setDraftHydrated(false)
    let cancelled = false
    getComposerState(workspaceId, channelId)
      .then((draft) => {
        if (cancelled) return
        const content = draft?.html || draft?.text || ''
        if (!content && draftEdge.draftLoad === 'fill') return
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
  }, [editor, workspaceId, channelId, draftEdge, isMobile, setIsEmojiOnly, setDraftHydrated])

  useEffect(() => {
    if (!editor || !editMessageMemory || editMessageMemory.channel_id !== channelId) return
    const content = editMessageMemory.html || editMessageMemory.content || ''
    if (isMobile) editor.commands.setContent(content)
    else editor.chain().setContent(content).focus('start').run()
  }, [editor, editMessageMemory, channelId, isMobile])
}
