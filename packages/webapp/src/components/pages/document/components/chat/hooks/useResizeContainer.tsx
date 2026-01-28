import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore, useChatStore } from '@stores'

/**
 * Design System Panel Constraints
 * @see Notes/Design_System_Global_v2.md
 */
const CHAT_MIN_HEIGHT = 320 // Minimum height for Chat panel
const CHAT_MAX_HEIGHT = 520 // Maximum height for Chat panel
const CHAT_DEFAULT_HEIGHT = 410 // Default height
const LOCAL_STORAGE_KEY = 'docsy:chat-height'

/**
 * Hook for managing chat panel resize functionality.
 *
 * Design System Requirements:
 * - Min height: 320px
 * - Max height: 520px (or 70% of viewport, whichever is smaller)
 * - Persist height per user
 * - During drag, disable text selection
 *
 * @returns Chat resize state and handlers
 */
const useResizeContainer = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const setOrUpdateChatPannelHeight = useChatStore((state) => state.setOrUpdateChatPannelHeight)
  const { pannelHeight: storeHeight } = useChatStore((state) => state.chatRoom)
  const [isResizing, setIsResizing] = useState(false)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // Load persisted height on mount (or use default)
  useEffect(() => {
    try {
      const storedHeight = localStorage.getItem(LOCAL_STORAGE_KEY)
      const maxHeight = Math.min(CHAT_MAX_HEIGHT, window.innerHeight * 0.7)

      if (storedHeight) {
        const parsed = parseInt(storedHeight, 10)
        if (!isNaN(parsed)) {
          setOrUpdateChatPannelHeight(Math.min(maxHeight, Math.max(CHAT_MIN_HEIGHT, parsed)))
          return
        }
      }
      // No stored value - use default
      setOrUpdateChatPannelHeight(Math.min(maxHeight, CHAT_DEFAULT_HEIGHT))
    } catch {
      // Ignore localStorage errors
    }
  }, [setOrUpdateChatPannelHeight])

  // Persist height changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(storeHeight))
    } catch {
      // Ignore localStorage errors
    }
  }, [storeHeight])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return

      e.preventDefault()
      setIsResizing(true)

      const startY = e.clientY
      const startHeight = containerRef.current.clientHeight
      const maxHeight = Math.min(CHAT_MAX_HEIGHT, window.innerHeight * 0.7)

      // Disable text selection and set resize cursor
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'row-resize'

      // Disable editor during resize to prevent interference
      if (editor?.isEditable) editor.setEditable(false)

      const doDrag = (e: MouseEvent) => {
        e.preventDefault()
        const deltaY = startY - e.clientY
        const newHeight = startHeight + deltaY

        // Clamp to min/max constraints
        const clampedHeight = Math.min(maxHeight, Math.max(CHAT_MIN_HEIGHT, newHeight))
        setOrUpdateChatPannelHeight(clampedHeight)
      }

      const stopDrag = () => {
        setIsResizing(false)
        // Re-enable editor
        if (editor && !editor.isEditable) editor.setEditable(true)
        // Re-enable text selection
        document.body.style.userSelect = ''
        document.body.style.cursor = ''

        document.removeEventListener('mousemove', doDrag)
        document.removeEventListener('mouseup', stopDrag)
      }

      document.addEventListener('mousemove', doDrag)
      document.addEventListener('mouseup', stopDrag)
    },
    [editor, setOrUpdateChatPannelHeight]
  )

  // Handle window resize - validate height constraints
  useEffect(() => {
    const handleWindowResize = () => {
      const maxHeight = Math.min(CHAT_MAX_HEIGHT, window.innerHeight * 0.7)

      if (storeHeight > maxHeight) {
        setOrUpdateChatPannelHeight(maxHeight)
      } else if (storeHeight < CHAT_MIN_HEIGHT) {
        setOrUpdateChatPannelHeight(CHAT_MIN_HEIGHT)
      }
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [storeHeight, setOrUpdateChatPannelHeight])

  return {
    handleMouseDown,
    containerRef,
    height: storeHeight,
    isResizing
  }
}

export default useResizeContainer
