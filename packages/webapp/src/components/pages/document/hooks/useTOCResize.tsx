import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Design System Panel Constraints
 * @see Notes/Design_System_Global_v2.md
 */
const TOC_MIN_WIDTH = 240 // Minimum width for TOC in pixels
const TOC_MAX_WIDTH = 420 // Maximum width for TOC in pixels
const TOC_DEFAULT_WIDTH = 320 // Default width if nothing in local storage
const LOCAL_STORAGE_KEY = 'docsy:toc-width'

/**
 * Hook for managing TOC panel resize functionality.
 *
 * Design System Requirements:
 * - Min width: 240px
 * - Max width: 420px
 * - Persist width per user
 * - During drag, disable text selection
 *
 * @returns TOC resize state and handlers
 */
export const useTOCResize = () => {
  const tocRef = useRef<HTMLDivElement>(null)
  const [tocWidth, setTocWidth] = useState<number>(TOC_DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartXRef = useRef<number>(0)
  const initialTocWidthRef = useRef<number>(0)

  // Load persisted width on mount
  useEffect(() => {
    try {
      const storedWidth = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (storedWidth) {
        const parsed = parseInt(storedWidth, 10)
        if (!isNaN(parsed)) {
          // Clamp to valid range
          setTocWidth(Math.min(TOC_MAX_WIDTH, Math.max(TOC_MIN_WIDTH, parsed)))
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Persist width changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(tocWidth))
    } catch {
      // Ignore localStorage errors
    }
  }, [tocWidth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    dragStartXRef.current = e.clientX
    if (tocRef.current) {
      initialTocWidthRef.current = tocRef.current.offsetWidth
    }
    // Disable text selection during drag
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    // Re-enable text selection
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return

      const dx = e.clientX - dragStartXRef.current
      const newWidth = initialTocWidthRef.current + dx

      // Clamp to min/max constraints
      setTocWidth(Math.min(TOC_MAX_WIDTH, Math.max(TOC_MIN_WIDTH, newWidth)))
    },
    [isResizing]
  )

  // Add/remove global event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Editor container takes remaining width
  const editorContainerStyle = {
    width: `calc(100% - ${tocWidth}px)`,
    maxWidth: '100%'
  }

  return {
    tocRef,
    tocWidth,
    isResizing,
    handleMouseDown,
    editorContainerStyle
  }
}

export default useTOCResize
