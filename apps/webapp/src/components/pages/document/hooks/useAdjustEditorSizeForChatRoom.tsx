import { useChatStore } from '@stores'
import { RefObject, useEffect } from 'react'

export const useAdjustEditorSizeForChatRoom = (editorWrapperRef: RefObject<HTMLDivElement>) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  // Initial mount + post-drag commit: read panelHeight from the store and
  // apply once. Drag-time updates bypass React via the `chat-panel-resize-tick`
  // listener below.
  useEffect(() => {
    const editorWrapper = editorWrapperRef.current

    if (!editorWrapper) return
    if (!chatRoom.documentId) {
      editorWrapper.style.marginBottom = '0'
      return
    }

    editorWrapper.style.marginBottom = `${chatRoom.panelHeight}px`
  }, [editorWrapperRef, chatRoom.panelHeight, chatRoom.documentId])

  // Live drag mirror: `useResizeContainer.doDrag` writes the panel height
  // directly to its container ref and dispatches this event. We mirror to
  // the editor wrapper's marginBottom imperatively so the editor follows
  // the chat panel without a 60×/sec store write + React re-render storm.
  useEffect(() => {
    const onTick = (e: Event) => {
      const editorWrapper = editorWrapperRef.current
      if (!editorWrapper) return
      const height = (e as CustomEvent<number>).detail
      if (typeof height === 'number') {
        editorWrapper.style.marginBottom = `${height}px`
      }
    }
    window.addEventListener('chat-panel-resize-tick', onTick)
    return () => window.removeEventListener('chat-panel-resize-tick', onTick)
  }, [editorWrapperRef])
}
