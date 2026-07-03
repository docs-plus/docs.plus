import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const TOC_MIN_WIDTH = 240
/** Max TOC width as a fraction of the editor workspace (`.editor` row). */
export const TOC_MAX_WIDTH_RATIO = 0.46
export const TOC_DEFAULT_WIDTH = 320
export const TOC_WIDTH_STORAGE_KEY = 'docsy:toc-width'

export const getTocMaxWidth = (containerWidth: number): number => {
  if (containerWidth <= 0) return TOC_DEFAULT_WIDTH
  return Math.max(TOC_MIN_WIDTH, Math.floor(containerWidth * TOC_MAX_WIDTH_RATIO))
}

export const clampTocWidth = (width: number, containerWidth: number): number => {
  const max = getTocMaxWidth(containerWidth)
  return Math.min(max, Math.max(TOC_MIN_WIDTH, width))
}

/** Width of the `.pad .editor` flex row — shared by live resize + slug skeleton. */
export const readEditorWorkspaceWidth = (): number => {
  if (typeof document === 'undefined') return 0
  const editor = document.querySelector('.pad .editor')
  return editor?.getBoundingClientRect().width ?? 0
}

/** Parent of the TOC column when mounted; otherwise the editor row or viewport. */
export const resolveTocContainerWidth = (tocEl: HTMLDivElement | null | undefined): number => {
  const fromParent = tocEl?.parentElement?.offsetWidth ?? 0
  if (fromParent > 0) return fromParent
  const fromEditor = readEditorWorkspaceWidth()
  if (fromEditor > 0) return fromEditor
  return typeof window !== 'undefined' ? window.innerWidth : 0
}

export const readPersistedTocWidth = (): number => {
  try {
    const parsed = parseInt(localStorage.getItem(TOC_WIDTH_STORAGE_KEY) ?? '', 10)
    if (!isNaN(parsed)) {
      return Math.max(TOC_MIN_WIDTH, parsed)
    }
  } catch {
    // localStorage unavailable — fall through to the default
  }
  return TOC_DEFAULT_WIDTH
}

export const useTocResize = () => {
  const tocRef = useRef<HTMLDivElement>(null)
  const [tocWidth, setTocWidth] = useState<number>(TOC_DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartXRef = useRef<number>(0)
  const initialTocWidthRef = useRef<number>(0)

  const clampCurrentWidthToContainer = useCallback(() => {
    const containerWidth = resolveTocContainerWidth(tocRef.current)
    if (containerWidth <= 0) return
    setTocWidth((prev) => clampTocWidth(prev, containerWidth))
  }, [])

  useLayoutEffect(() => {
    const parent = tocRef.current?.parentElement
    if (!parent) return

    const containerWidth = resolveTocContainerWidth(tocRef.current)
    if (containerWidth > 0) {
      setTocWidth(clampTocWidth(readPersistedTocWidth(), containerWidth))
    }

    const observer = new ResizeObserver(clampCurrentWidthToContainer)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [clampCurrentWidthToContainer])

  useEffect(() => {
    try {
      localStorage.setItem(TOC_WIDTH_STORAGE_KEY, String(tocWidth))
    } catch {
      // Ignore localStorage errors
    }
  }, [tocWidth])

  useEffect(() => {
    window.addEventListener('resize', clampCurrentWidthToContainer)
    return () => window.removeEventListener('resize', clampCurrentWidthToContainer)
  }, [clampCurrentWidthToContainer])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    dragStartXRef.current = e.clientX
    if (tocRef.current) {
      initialTocWidthRef.current = tocRef.current.offsetWidth
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return

      const containerWidth = resolveTocContainerWidth(tocRef.current)
      const maxWidth = getTocMaxWidth(containerWidth)
      const dx = e.clientX - dragStartXRef.current
      const newWidth = initialTocWidthRef.current + dx

      setTocWidth(Math.min(maxWidth, Math.max(TOC_MIN_WIDTH, newWidth)))
    },
    [isResizing]
  )

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

  return {
    tocRef,
    tocWidth,
    isResizing,
    handleMouseDown
  }
}

export default useTocResize
