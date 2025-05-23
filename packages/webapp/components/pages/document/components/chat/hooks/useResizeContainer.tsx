import React, { useRef } from 'react'
import { useStore, useChatStore } from '@stores'

const useResizeContainer = () => {
  const gripperRef = useRef<HTMLDivElement>(null)
  const setOrUpdateChatPannelHeight = useChatStore((state) => state.setOrUpdateChatPannelHeight)
  const { pannelHeight: height } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // Define maximum and minimum heights
  const maxHeight = window.innerHeight * 0.7 // 70% of screen height
  const minHeight = Math.max(260, window.innerHeight * 0.15) // 15% of screen height, with absolute minimum of 260px

  const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
    if (!gripperRef.current) return

    const startY = e.clientY
    const startHeight = gripperRef.current.clientHeight

    const doDrag = (e: MouseEvent) => {
      let newHeight = startHeight - e.clientY + startY
      if (editor?.isEditable) editor?.setEditable(false)

      // Clamping the new height between the min and max values
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))

      // Update the height
      setOrUpdateChatPannelHeight(newHeight)
    }

    const stopDrag = () => {
      if (!editor?.isEditable) editor?.setEditable(true)

      document.documentElement.removeEventListener('mousemove', doDrag as EventListener, false)
      document.documentElement.removeEventListener('mouseup', stopDrag as EventListener, false)
    }

    document.documentElement.addEventListener('mousemove', doDrag as EventListener, false)
    document.documentElement.addEventListener('mouseup', stopDrag as EventListener, false)
  }

  return {
    handleMouseDown,
    gripperRef,
    height
  }
}

export default useResizeContainer
