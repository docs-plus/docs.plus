import { useState, useRef, useEffect, useCallback } from 'react'

const MIN_TOC_WIDTH = 320 // Minimum width for TOC in pixels
const DEFAULT_TOC_WIDTH = '22%' // Default width if nothing in local storage
const LOCAL_STORAGE_TOC_WIDTH_KEY = 'tocOptimalWidth'

export const useTOCResize = () => {
  const tocRef = useRef<HTMLDivElement>(null)
  const [tocWidth, setTocWidth] = useState<string | number>(DEFAULT_TOC_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartXRef = useRef<number>(0)
  const initialTocWidthRef = useRef<number>(0)

  useEffect(() => {
    const storedWidth = localStorage.getItem(LOCAL_STORAGE_TOC_WIDTH_KEY)
    if (storedWidth) {
      setTocWidth(`${Math.max(parseInt(storedWidth, 10), MIN_TOC_WIDTH)}px`)
    }
  }, [])

  useEffect(() => {
    if (typeof tocWidth === 'number' || (typeof tocWidth === 'string' && tocWidth.endsWith('px'))) {
      localStorage.setItem(LOCAL_STORAGE_TOC_WIDTH_KEY, String(parseInt(`${tocWidth}`, 10)))
    }
  }, [tocWidth])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    dragStartXRef.current = e.clientX
    if (tocRef.current) {
      initialTocWidthRef.current = tocRef.current.offsetWidth
    }
  }

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return

      const dx = e.clientX - dragStartXRef.current
      const newWidth = initialTocWidthRef.current + dx

      setTocWidth(`${Math.max(newWidth, MIN_TOC_WIDTH)}px`)
    },
    [isResizing]
  )

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const editorContainerStyle = {
    width: `calc(100% - ${tocWidth})`,
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
