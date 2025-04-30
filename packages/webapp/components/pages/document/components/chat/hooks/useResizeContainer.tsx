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
  const maxHeight = 700 // Example max height
  const minHeight = 300 // Example min height

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
