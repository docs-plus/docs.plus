import { useCallback, useEffect } from 'react'
import { useMessageComposer } from './useMessageComposer'
import { useChatroomContext } from '../../../ChatroomContext'

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
    [replyMessageMemory, editMessageMemory, commentMessageMemory, channelId]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [handleEsc])

  return handleEsc
}
