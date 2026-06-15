import { useChatStore } from '@stores'
import { MOTION_PANEL_MS, prefersReducedMotion } from '@utils/motion'
import { RefObject, useEffect } from 'react'

// Matches the chat panel's 200ms entry fade; suspended while the handle drags.
const MARGIN_TRANSITION = `margin-bottom ${MOTION_PANEL_MS}ms ease-out`

export const useAdjustEditorSizeForChatRoom = (editorWrapperRef: RefObject<HTMLDivElement>) => {
  const chatRoom = useChatStore((state) => state.chatRoom)

  // Initial mount + post-drag commit: read panelHeight from the store and
  // apply once. Drag-time updates bypass React via the `chat-panel-resize-tick`
  // listener below.
  useEffect(() => {
    const editorWrapper = editorWrapperRef.current

    if (!editorWrapper) return
    // Inline (not a class) so the drag gate below can suspend and restore it.
    editorWrapper.style.transition = prefersReducedMotion() ? '' : MARGIN_TRANSITION
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
    // Drag gate: kill the open/close transition while the handle drags so the
    // margin tracks the pointer 1:1, then restore it on mouseup.
    const onDragStart = () => {
      const editorWrapper = editorWrapperRef.current
      if (editorWrapper) editorWrapper.style.transition = 'none'
    }
    const onDragEnd = () => {
      const editorWrapper = editorWrapperRef.current
      if (editorWrapper) {
        editorWrapper.style.transition = prefersReducedMotion() ? '' : MARGIN_TRANSITION
      }
    }
    window.addEventListener('chat-panel-resize-tick', onTick)
    window.addEventListener('chat-panel-resize-start', onDragStart)
    window.addEventListener('chat-panel-resize-end', onDragEnd)
    return () => {
      window.removeEventListener('chat-panel-resize-tick', onTick)
      window.removeEventListener('chat-panel-resize-start', onDragStart)
      window.removeEventListener('chat-panel-resize-end', onDragEnd)
    }
  }, [editorWrapperRef])
}
