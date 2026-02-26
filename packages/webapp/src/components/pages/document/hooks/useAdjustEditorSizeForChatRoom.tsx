import { useChatStore } from '@stores'
import { RefObject, useEffect } from 'react'

export const useAdjustEditorSizeForChatRoom = (editorWrapperRef: RefObject<HTMLDivElement>) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  // adjust the editor size base on the chat room pannel height
  useEffect(() => {
    const editorWrapper = editorWrapperRef.current

    if (!editorWrapper) return
    if (!chatRoom.documentId) {
      editorWrapper.style.marginBottom = '0'
      return
    }

    editorWrapper.style.marginBottom = `${chatRoom.panelHeight}px`
  }, [editorWrapperRef.current, chatRoom.panelHeight, chatRoom.documentId])
}
