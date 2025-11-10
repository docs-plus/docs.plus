import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@stores'

// Assuming 'startThreadMessage' has a type you can import, replace 'any' with that type
type StartThreadMessageType = any // Use the appropriate type here

export const useChatContainerResizeHandler = () => {
  const startThreadMessage = useChatStore(
    (state) => state.startThreadMessage as StartThreadMessageType
  )
  const [leftWidth, setLeftWidth] = useState<number>(100) // Initial width as a percentage
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<{ startX: number; startWidth: number }>({
    startX: 0,
    startWidth: 0
  })
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    if (startThreadMessage) {
      setLeftWidth(60)
    } else {
      setLeftWidth(100)
    }
  }, [startThreadMessage])

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panelRef.current && e.button === 0) {
      dragState.current = {
        startX: e.clientX,
        startWidth: panelRef.current.offsetWidth
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }
  }

  const onMouseMove = (e: MouseEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current)

    rafId.current = requestAnimationFrame(() => {
      if (dragState.current.startX && panelRef.current && panelRef.current.parentElement) {
        const currentX = e.clientX
        const diffX = currentX - dragState.current.startX
        const newWidth =
          ((dragState.current.startWidth + diffX) / panelRef.current.parentElement.offsetWidth) *
          100
        setLeftWidth(Math.max(20, Math.min(80, newWidth))) // Constrain width
      }
    })
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }

  return { onMouseDown, leftWidth, panelRef }
}
