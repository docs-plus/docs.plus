import { selectDocumentId, useStore } from '@stores'
import { MOTION_OVERLAY_IN_MS, prefersReducedMotion } from '@utils/motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const TOC_MIN_WIDTH = 240
/** Max TOC width as a fraction of the editor workspace (`.editor` row). */
export const TOC_MAX_WIDTH_RATIO = 0.46
export const TOC_DEFAULT_WIDTH = 320
export const TOC_WIDTH_STORAGE_KEY = 'docsy:toc-width'
export const TOC_RAIL_WIDTH = 32
export const TOC_SNAP_WIDTH = 120

type TocMode = 'wide' | 'rail' | 'drag' | 'settle-to-rail' | 'settle-to-wide'

const rememberedWideWidth = (width: number): number =>
  width > TOC_MIN_WIDTH ? width : TOC_DEFAULT_WIDTH

type TocReleaseStep =
  | { action: 'cancel' }
  | {
      action: 'apply'
      mode: TocMode
      paint: number
      tocWidth: number | null
      lastWide: number
    }

/** Intended drag + last-wide + clamp → next mode, Painted width, tocWidth. */
export const stepTocRelease = (
  intended: number | null,
  lastWide: number,
  dragMax: number,
  reduced: boolean
): TocReleaseStep => {
  if (intended == null) return { action: 'cancel' }
  if (intended < TOC_SNAP_WIDTH) {
    const wide = rememberedWideWidth(lastWide)
    return {
      action: 'apply',
      mode: reduced || intended <= TOC_RAIL_WIDTH ? 'rail' : 'settle-to-rail',
      paint: TOC_RAIL_WIDTH,
      tocWidth: wide,
      lastWide: wide
    }
  }
  const next = Math.min(dragMax, intended)
  if (next <= TOC_MIN_WIDTH) {
    return {
      action: 'apply',
      mode: 'wide',
      paint: TOC_MIN_WIDTH,
      tocWidth: null,
      lastWide
    }
  }
  return {
    action: 'apply',
    mode: 'wide',
    paint: next,
    tocWidth: next,
    lastWide: next
  }
}

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

/** Prefer the editor row so a rail remount cannot shrink the clamp base. */
export const resolveTocContainerWidth = (tocEl: HTMLDivElement | null | undefined): number => {
  const fromEditor = readEditorWorkspaceWidth()
  if (fromEditor > 0) return fromEditor
  const fromParent = tocEl?.parentElement?.offsetWidth ?? 0
  if (fromParent > 0) return fromParent
  return typeof window !== 'undefined' ? window.innerWidth : 0
}

export const readPersistedTocWidth = (): number => {
  try {
    const parsed = parseInt(localStorage.getItem(TOC_WIDTH_STORAGE_KEY) ?? '', 10)
    if (Number.isFinite(parsed) && parsed > TOC_MIN_WIDTH) return parsed
  } catch {
    // localStorage unavailable — fall through to the default
  }
  return TOC_DEFAULT_WIDTH
}

const persistTocWidth = (width: number) => {
  if (width <= TOC_MIN_WIDTH) return
  try {
    localStorage.setItem(TOC_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // private-mode / quota — width stays in memory
  }
}

const clearResizeCursor = () => {
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

export const useTocResize = () => {
  const tocRef = useRef<HTMLDivElement>(null)
  const workspaceId = useStore(selectDocumentId)
  const [tocWidth, setTocWidth] = useState<number>(TOC_DEFAULT_WIDTH)
  const [paint, setPaint] = useState<number>(TOC_DEFAULT_WIDTH)
  const [mode, setMode] = useState<TocMode>('wide')
  const [hydrated, setHydrated] = useState(false)
  const lastWideWidthRef = useRef(TOC_DEFAULT_WIDTH)
  const paintRef = useRef(paint)
  paintRef.current = paint
  const prevWorkspaceIdRef = useRef(workspaceId)
  const dragStartXRef = useRef(0)
  const initialPaintedWidthRef = useRef(0)
  const intendedWidthRef = useRef<number | null>(null)
  const dragMaxWidthRef = useRef(0)
  const modeRef = useRef<TocMode>('wide')

  modeRef.current = mode
  const isRail = mode === 'rail'
  const isResizing = mode === 'drag'
  const isSettlingToRail = mode === 'settle-to-rail'
  const isContentHidden =
    mode === 'settle-to-rail' ||
    mode === 'settle-to-wide' ||
    (mode === 'drag' && paint < TOC_MIN_WIDTH)

  const reduced = prefersReducedMotion()

  const focusWideToc = useCallback(() => {
    const root = tocRef.current
    const next = root?.querySelector<HTMLElement>('a[href], button:not([disabled])')
    next?.focus({ preventScroll: true })
  }, [])

  const clampCurrentWidthToContainer = useCallback(() => {
    if (modeRef.current !== 'wide' && modeRef.current !== 'settle-to-wide') return
    if (modeRef.current === 'wide' && paintRef.current <= TOC_MIN_WIDTH) return
    const containerWidth = resolveTocContainerWidth(tocRef.current)
    if (containerWidth <= 0) return
    const next = clampTocWidth(rememberedWideWidth(lastWideWidthRef.current), containerWidth)
    setTocWidth(next)
    if (modeRef.current === 'wide') setPaint(next)
  }, [])

  useLayoutEffect(() => {
    const persisted = readPersistedTocWidth()
    lastWideWidthRef.current = persisted
    const containerWidth = resolveTocContainerWidth(tocRef.current)
    const next = containerWidth > 0 ? clampTocWidth(persisted, containerWidth) : persisted
    setTocWidth(next)
    setPaint(
      modeRef.current === 'rail' || modeRef.current === 'settle-to-rail' ? TOC_RAIL_WIDTH : next
    )
    setHydrated(true)

    const editor = document.querySelector('.pad .editor')
    if (!editor) return
    const observer = new ResizeObserver(clampCurrentWidthToContainer)
    observer.observe(editor)
    return () => observer.disconnect()
  }, [clampCurrentWidthToContainer])

  useEffect(() => {
    if (!hydrated) return
    const current = modeRef.current
    if (current === 'rail' || current === 'settle-to-rail' || current === 'drag') return
    persistTocWidth(tocWidth)
  }, [hydrated, tocWidth])

  useEffect(() => {
    if (prevWorkspaceIdRef.current === workspaceId) return
    prevWorkspaceIdRef.current = workspaceId
    const remembered = rememberedWideWidth(lastWideWidthRef.current)
    lastWideWidthRef.current = remembered
    const wide = clampTocWidth(remembered, resolveTocContainerWidth(tocRef.current))
    setTocWidth(wide)
    setPaint(wide)
    setMode('wide')
  }, [workspaceId])

  useEffect(() => {
    if (mode !== 'settle-to-rail' && mode !== 'settle-to-wide') return
    if (mode === 'settle-to-wide' && paint === TOC_RAIL_WIDTH) return
    const nextMode = mode === 'settle-to-rail' ? 'rail' : 'wide'
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setMode(nextMode)
      if (nextMode === 'wide') window.setTimeout(focusWideToc, 0)
    }
    const fallback = window.setTimeout(finish, MOTION_OVERLAY_IN_MS + 50)
    const el = tocRef.current
    if (!el) return () => window.clearTimeout(fallback)

    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el) return
      if (event.propertyName !== 'width') return
      finish()
    }
    el.addEventListener('transitionend', onEnd)
    return () => {
      el.removeEventListener('transitionend', onEnd)
      window.clearTimeout(fallback)
    }
  }, [focusWideToc, mode, paint])

  useEffect(() => {
    if (mode !== 'settle-to-wide') return
    const target = clampTocWidth(
      rememberedWideWidth(lastWideWidthRef.current),
      resolveTocContainerWidth(tocRef.current)
    )
    if (paint === target) return
    const id = window.setTimeout(() => setPaint(target), 16)
    return () => window.clearTimeout(id)
  }, [mode, paint])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const intended = initialPaintedWidthRef.current + (event.clientX - dragStartXRef.current)
    intendedWidthRef.current = intended

    if (intended < TOC_MIN_WIDTH) {
      setPaint(Math.max(TOC_RAIL_WIDTH, intended))
      return
    }

    const next = Math.min(dragMaxWidthRef.current, intended)
    if (next > lastWideWidthRef.current) lastWideWidthRef.current = next
    setPaint(next)
  }, [])

  const handleMouseUp = useCallback(() => {
    const intended = intendedWidthRef.current
    intendedWidthRef.current = null
    clearResizeCursor()
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('pointercancel', handleMouseUp)

    const step = stepTocRelease(
      intended,
      lastWideWidthRef.current,
      dragMaxWidthRef.current,
      reduced
    )
    if (step.action === 'cancel') {
      setMode('wide')
      return
    }
    lastWideWidthRef.current = step.lastWide
    if (step.tocWidth != null) {
      setTocWidth(step.tocWidth)
      persistTocWidth(step.tocWidth)
    }
    setPaint(step.paint)
    setMode(step.mode)
  }, [handleMouseMove, reduced])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      setMode('drag')
      dragStartXRef.current = event.clientX
      dragMaxWidthRef.current = getTocMaxWidth(resolveTocContainerWidth(tocRef.current))
      const start = tocRef.current?.offsetWidth ?? tocWidth
      initialPaintedWidthRef.current = start
      intendedWidthRef.current = start
      setPaint(start)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('pointercancel', handleMouseUp)
    },
    [handleMouseMove, handleMouseUp, tocWidth]
  )

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('pointercancel', handleMouseUp)
      clearResizeCursor()
    }
  }, [handleMouseMove, handleMouseUp])

  const openWide = useCallback(() => {
    const remembered = rememberedWideWidth(lastWideWidthRef.current)
    lastWideWidthRef.current = remembered
    const wide = clampTocWidth(remembered, resolveTocContainerWidth(tocRef.current))
    setTocWidth(wide)
    if (reduced) {
      setPaint(wide)
      setMode('wide')
      window.setTimeout(focusWideToc, 0)
      return
    }
    setPaint(TOC_RAIL_WIDTH)
    setMode('settle-to-wide')
  }, [focusWideToc, reduced])

  return {
    tocRef,
    paintedWidth: paint,
    isResizing,
    isRail,
    isSettlingToRail,
    isContentHidden,
    handleMouseDown,
    openWide
  }
}

export default useTocResize
