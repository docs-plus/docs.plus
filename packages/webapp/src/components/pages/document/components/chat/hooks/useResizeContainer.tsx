import React, { useCallback, useEffect, useRef } from 'react'
import { useStore, useChatStore } from '@stores'

const useResizeContainer = () => {
  const gripperRef = useRef<HTMLDivElement>(null)
  const setOrUpdateChatPannelHeight = useChatStore((state) => state.setOrUpdateChatPannelHeight)
  const { pannelHeight: height } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (!gripperRef.current) return

      e.preventDefault()

      const editorWrapper = document.querySelector('.editorWrapper') as HTMLDivElement
      const maxHeight = window.innerHeight * 0.7
      const minHeight = Math.max(260, (editorWrapper?.clientHeight || 0) * 0.15)

      const startY = e.clientY
      const startHeight = gripperRef.current.clientHeight

      // Prevent text selection during drag
      document.body.style.userSelect = 'none'

      const doDrag = (e: MouseEvent) => {
        e.preventDefault()
        let newHeight = startHeight - e.clientY + startY

        if (editor?.isEditable) editor.setEditable(false)
        newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))
        setOrUpdateChatPannelHeight(newHeight)
      }

      const stopDrag = () => {
        if (editor && !editor.isEditable) editor.setEditable(true)
        document.body.style.userSelect = ''

        document.removeEventListener('mousemove', doDrag)
        document.removeEventListener('mouseup', stopDrag)
      }

      document.addEventListener('mousemove', doDrag)
      document.addEventListener('mouseup', stopDrag)
    },
    [editor, setOrUpdateChatPannelHeight]
  )

  // Simple resize handler to validate height constraints
  useEffect(() => {
    const handleResize = () => {
      const editorWrapper = document.querySelector('.editorWrapper') as HTMLDivElement
      const maxHeight = window.innerHeight * 0.7
      const minHeight = Math.max(260, (editorWrapper?.clientHeight || 0) * 0.15)

      if (height > maxHeight) {
        setOrUpdateChatPannelHeight(maxHeight)
      } else if (height < minHeight) {
        setOrUpdateChatPannelHeight(minHeight)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [height, setOrUpdateChatPannelHeight])

  return {
    handleMouseDown,
    gripperRef,
    height
  }
}

export default useResizeContainer
