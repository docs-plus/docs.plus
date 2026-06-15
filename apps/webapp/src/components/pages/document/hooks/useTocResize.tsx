import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Design System Panel Constraints
 * @see Notes/Design_System_Global_v2.md
 */
export const TOC_MIN_WIDTH = 240
export const TOC_MAX_WIDTH = 420
export const TOC_DEFAULT_WIDTH = 320
export const TOC_WIDTH_STORAGE_KEY = 'docsy:toc-width'

// Shared with SlugPageLoader so the skeleton's TOC column matches the user's width.
export const readPersistedTocWidth = (): number => {
  try {
    const parsed = parseInt(localStorage.getItem(TOC_WIDTH_STORAGE_KEY) ?? '', 10)
    if (!isNaN(parsed)) {
      return Math.min(TOC_MAX_WIDTH, Math.max(TOC_MIN_WIDTH, parsed))
    }
  } catch {
    // localStorage unavailable — fall through to the default
  }
  return TOC_DEFAULT_WIDTH
}

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
export const useTocResize = () => {
  const tocRef = useRef<HTMLDivElement>(null)
  const [tocWidth, setTocWidth] = useState<number>(TOC_DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartXRef = useRef<number>(0)
  const initialTocWidthRef = useRef<number>(0)

  // Load persisted width on mount
  useEffect(() => {
    setTocWidth(readPersistedTocWidth())
  }, [])

  // Persist width changes
  useEffect(() => {
    try {
      localStorage.setItem(TOC_WIDTH_STORAGE_KEY, String(tocWidth))
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

export default useTocResize
