import { closeHeadingChatroom } from '@services/eventsHub'
import { useChatStore, useStore } from '@stores'
import { MOTION_OVERLAY_IN_MS, prefersReducedMotion } from '@utils/motion'
import { useCallback, useEffect, useRef, useState } from 'react'

const CHAT_MIN_HEIGHT = 320
/** Same ratio as `TOC_SNAP_WIDTH` / `TOC_MIN_WIDTH` (120 / 240). */
const CHAT_SNAP_HEIGHT = Math.floor(CHAT_MIN_HEIGHT / 2)
const CHAT_MAX_HEIGHT = 1200
const CHAT_DEFAULT_HEIGHT = 410
const LOCAL_STORAGE_KEY = 'docsy:chat-height'

type ChatSashMode = 'open' | 'drag' | 'settle-to-min' | 'settle-to-close'

type ChatReleaseStep =
  | { action: 'close-now' }
  | { action: 'settle-close' }
  | { action: 'abort-now' }
  | { action: 'settle-min' }
  | { action: 'commit'; height: number }

const paintChatHeight = (intended: number, maxHeight: number): number => {
  if (intended >= CHAT_MIN_HEIGHT) return Math.min(maxHeight, intended)
  return Math.max(0, intended)
}

const stepChatRelease = (
  intended: number,
  painted: number,
  maxHeight: number,
  reduced: boolean
): ChatReleaseStep => {
  if (intended < CHAT_SNAP_HEIGHT) {
    return reduced || intended <= 0 ? { action: 'close-now' } : { action: 'settle-close' }
  }
  if (intended < CHAT_MIN_HEIGHT) {
    return reduced ? { action: 'abort-now' } : { action: 'settle-min' }
  }
  return { action: 'commit', height: Math.min(maxHeight, painted) }
}

const useResizeContainer = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const setOrUpdateChatPanelHeight = useChatStore((state) => state.setOrUpdateChatPanelHeight)
  const storeHeight = useChatStore((state) => state.chatRoom.panelHeight)
  const [paint, setPaint] = useState(storeHeight)
  const [mode, setMode] = useState<ChatSashMode>('open')
  const [isOvershoot, setIsOvershoot] = useState(false)
  const editor = useStore((state) => state.settings.editor.instance)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const overshootRef = useRef(false)
  const isSettling = mode === 'settle-to-min' || mode === 'settle-to-close'

  const applyOvershoot = (overshoot: boolean) => {
    if (overshootRef.current === overshoot) return
    overshootRef.current = overshoot
    setIsOvershoot(overshoot)
  }

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
    if (storeHeight < CHAT_MIN_HEIGHT) return
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(storeHeight))
    } catch {
      // private-mode / quota — height stays in memory
    }
  }, [storeHeight])

  useEffect(() => {
    if (mode !== 'open') return
    setPaint(storeHeight)
  }, [mode, storeHeight])

  useEffect(() => {
    if (mode !== 'settle-to-min' && mode !== 'settle-to-close') return
    const el = containerRef.current
    if (!el) {
      setMode('open')
      return
    }

    const ro = new ResizeObserver(() => {
      window.dispatchEvent(
        new CustomEvent('chat-panel-resize-tick', {
          detail: el.getBoundingClientRect().height
        })
      )
    })
    ro.observe(el)

    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (mode === 'settle-to-close') {
        closeHeadingChatroom()
      } else {
        setOrUpdateChatPanelHeight(CHAT_MIN_HEIGHT)
      }
      window.dispatchEvent(new CustomEvent('chat-panel-resize-end'))
      setMode('open')
    }
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el) return
      if (event.propertyName !== 'height') return
      finish()
    }
    const fallback = window.setTimeout(finish, MOTION_OVERLAY_IN_MS + 50)
    el.addEventListener('transitionend', onEnd)
    return () => {
      el.removeEventListener('transitionend', onEnd)
      window.clearTimeout(fallback)
      ro.disconnect()
    }
  }, [mode, setOrUpdateChatPanelHeight])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current || isSettling) return

      e.preventDefault()
      applyOvershoot(false)
      setMode('drag')

      const startY = e.clientY
      // offsetHeight counts the 1px border-t; clientHeight would lose 1px per click.
      const startHeight = containerRef.current.offsetHeight
      const maxHeight = Math.min(CHAT_MAX_HEIGHT, window.innerHeight * 0.85)

      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'row-resize'

      const wasEditable = Boolean(editor?.isEditable)
      if (wasEditable) editor?.setEditable(false)

      // Bypass React during drag: write `style.height` on the ref and broadcast a
      // CustomEvent for siblings (`useSyncChatPanelHeight`). A Zustand write per
      // mousemove cascades 60×/sec through every `state.chatRoom` subscriber → Virtuoso's
      // ResizeObserver → bottom-smooth scroll thrash. Commit to the store ONCE on mouseup.
      let lastPaint = startHeight
      let lastIntended = startHeight
      const doDrag = (event: MouseEvent) => {
        event.preventDefault()
        const intended = startHeight + (startY - event.clientY)
        lastIntended = intended
        const painted = paintChatHeight(intended, maxHeight)
        if (!containerRef.current) return
        containerRef.current.style.height = `${painted}px`
        applyOvershoot(intended < CHAT_MIN_HEIGHT)
        lastPaint = painted
        window.dispatchEvent(new CustomEvent('chat-panel-resize-tick', { detail: painted }))
      }

      const abortDrag = () => {
        if (wasEditable && editor && !editor.isEditable) editor.setEditable(true)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        document.removeEventListener('mousemove', doDrag)
        document.removeEventListener('mouseup', stopDrag)
        document.removeEventListener('pointercancel', stopDrag)
      }

      const startSettle = (from: number, to: number, next: ChatSashMode) => {
        setPaint(from)
        setMode(next)
        window.requestAnimationFrame(() => {
          setPaint(to)
        })
      }

      const stopDrag = () => {
        dragCleanupRef.current = null
        abortDrag()
        applyOvershoot(false)

        const step = stepChatRelease(lastIntended, lastPaint, maxHeight, prefersReducedMotion())
        switch (step.action) {
          case 'close-now':
            setMode('open')
            closeHeadingChatroom()
            window.dispatchEvent(new CustomEvent('chat-panel-resize-end'))
            return
          case 'settle-close':
            startSettle(lastPaint, 0, 'settle-to-close')
            return
          case 'abort-now':
            // React skips the write when paint is already 320, so the dragged height would stay.
            if (containerRef.current) containerRef.current.style.height = `${CHAT_MIN_HEIGHT}px`
            setPaint(CHAT_MIN_HEIGHT)
            setMode('open')
            setOrUpdateChatPanelHeight(CHAT_MIN_HEIGHT)
            window.dispatchEvent(
              new CustomEvent('chat-panel-resize-tick', { detail: CHAT_MIN_HEIGHT })
            )
            window.dispatchEvent(new CustomEvent('chat-panel-resize-end'))
            return
          case 'settle-min':
            startSettle(lastPaint, CHAT_MIN_HEIGHT, 'settle-to-min')
            return
          case 'commit':
            setPaint(step.height)
            setMode('open')
            setOrUpdateChatPanelHeight(step.height)
            window.dispatchEvent(new CustomEvent('chat-panel-resize-end'))
            return
          default: {
            const _never: never = step
            return _never
          }
        }
      }

      dragCleanupRef.current = abortDrag
      document.addEventListener('mousemove', doDrag)
      document.addEventListener('mouseup', stopDrag)
      document.addEventListener('pointercancel', stopDrag)
    },
    [editor, isSettling, setOrUpdateChatPanelHeight]
  )

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    const handleWindowResize = () => {
      if (isSettling) return
      const maxHeight = Math.min(CHAT_MAX_HEIGHT, window.innerHeight * 0.85)

      if (storeHeight > maxHeight) {
        setOrUpdateChatPanelHeight(maxHeight)
      }
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [isSettling, storeHeight, setOrUpdateChatPanelHeight])

  return {
    handleMouseDown,
    containerRef,
    height: paint,
    isResizing: mode === 'drag',
    isContentHidden: mode === 'settle-to-close' || isOvershoot
  }
}

export default useResizeContainer
