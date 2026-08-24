import { useChatStore, useStore } from '@stores'
import { useCallback, useEffect, useRef, useState } from 'react'

const CHAT_MIN_HEIGHT = 320
const CHAT_MAX_HEIGHT = 1200
const CHAT_DEFAULT_HEIGHT = 410
const LOCAL_STORAGE_KEY = 'docsy:chat-height'

const useResizeContainer = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const setOrUpdateChatPanelHeight = useChatStore((state) => state.setOrUpdateChatPanelHeight)
  const { panelHeight: storeHeight } = useChatStore((state) => state.chatRoom)
  const [isResizing, setIsResizing] = useState(false)
  const editor = useStore((state) => state.settings.editor.instance)

  useEffect(() => {
    try {
      const storedHeight = localStorage.getItem(LOCAL_STORAGE_KEY)
      const maxHeight = Math.min(CHAT_MAX_HEIGHT, window.innerHeight * 0.85)

      if (storedHeight) {
        const parsed = parseInt(storedHeight, 10)
        if (!isNaN(parsed)) {
          setOrUpdateChatPanelHeight(Math.min(maxHeight, Math.max(CHAT_MIN_HEIGHT, parsed)))
          return
        }
      }
      setOrUpdateChatPanelHeight(Math.min(maxHeight, CHAT_DEFAULT_HEIGHT))
    } catch {
      // private-mode / quota — keep the default height
    }
  }, [setOrUpdateChatPanelHeight])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(storeHeight))
    } catch {
      // private-mode / quota — height stays in memory
    }
  }, [storeHeight])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return

      e.preventDefault()
      setIsResizing(true)
      // Suspend the editor's margin-bottom transition for the whole drag — the
      // per-frame mirror must follow the pointer 1:1 (useAdjustEditorSizeForChatRoom).
      window.dispatchEvent(new CustomEvent('chat-panel-resize-start'))

      const startY = e.clientY
      const startHeight = containerRef.current.clientHeight
      const maxHeight = Math.min(CHAT_MAX_HEIGHT, window.innerHeight * 0.85)

      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'row-resize'

      const wasEditable = Boolean(editor?.isEditable)
      if (wasEditable) editor?.setEditable(false)

      // Bypass React during drag: write `style.height` on the ref and broadcast a
      // CustomEvent for siblings (`useAdjustEditorSizeForChatRoom`). A Zustand write per
      // mousemove cascades 60×/sec through every `state.chatRoom` subscriber → Virtuoso's
      // ResizeObserver → bottom-smooth scroll thrash. Commit to the store ONCE on mouseup.
      let lastHeight = startHeight
      const doDrag = (e: MouseEvent) => {
        e.preventDefault()
        const deltaY = startY - e.clientY
        const newHeight = startHeight + deltaY
        const clampedHeight = Math.min(maxHeight, Math.max(CHAT_MIN_HEIGHT, newHeight))
        if (!containerRef.current) return
        containerRef.current.style.height = `${clampedHeight}px`
        lastHeight = clampedHeight
        window.dispatchEvent(new CustomEvent('chat-panel-resize-tick', { detail: clampedHeight }))
      }

      const stopDrag = () => {
        setIsResizing(false)
        window.dispatchEvent(new CustomEvent('chat-panel-resize-end'))
        setOrUpdateChatPanelHeight(lastHeight)
        // Re-enable only if this drag disabled it — never flip a
        // read-only document editable.
        if (wasEditable && editor && !editor.isEditable) editor.setEditable(true)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''

        document.removeEventListener('mousemove', doDrag)
        document.removeEventListener('mouseup', stopDrag)
      }

      document.addEventListener('mousemove', doDrag)
      document.addEventListener('mouseup', stopDrag)
    },
    [editor, setOrUpdateChatPanelHeight]
  )

  useEffect(() => {
    const handleWindowResize = () => {
      const maxHeight = Math.min(CHAT_MAX_HEIGHT, window.innerHeight * 0.85)

      if (storeHeight > maxHeight) {
        setOrUpdateChatPanelHeight(maxHeight)
      } else if (storeHeight < CHAT_MIN_HEIGHT) {
        setOrUpdateChatPanelHeight(CHAT_MIN_HEIGHT)
      }
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [storeHeight, setOrUpdateChatPanelHeight])

  return {
    handleMouseDown,
    containerRef,
    height: storeHeight,
    isResizing
  }
}

export default useResizeContainer
