import { useCallback, useEffect } from 'react'

import { useChatroomContext } from '../../../ChatroomContext'
import { isMentionSuggestionPopupVisible } from '../helpers/mentionTypes'
import {
  isComposerLinkDialogOpen,
  useComposerLinkDialogStore
} from '../stores/composerLinkDialogStore'
import { useMessageComposer } from './useMessageComposer'

export const useHandleEscKey = () => {
  const { channelId } = useChatroomContext()
  const {
    editor,
    replyMessageMemory,
    editMessageMemory,
    commentMessageMemory,
    setEditMsgMemory,
    setReplyMsgMemory,
    setCommentMsgMemory
  } = useMessageComposer()

  const handleEsc = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isComposerLinkDialogOpen()) {
          event.preventDefault()
          event.stopPropagation()
          useComposerLinkDialogStore.getState().cancel()
          return
        }
        if (isMentionSuggestionPopupVisible()) return

        if (replyMessageMemory) setReplyMsgMemory(channelId, null)
        if (editMessageMemory) {
          setEditMsgMemory(channelId, null)
          editor?.commands.clearContent(true)
        }
        if (commentMessageMemory) {
          setCommentMsgMemory(channelId, null)
          editor?.commands.clearContent(true)
        }
      }
    },
    [
      replyMessageMemory,
      editMessageMemory,
      commentMessageMemory,
      channelId,
      editor,
      setEditMsgMemory,
      setReplyMsgMemory,
      setCommentMsgMemory
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [handleEsc])

  return handleEsc
}
