import { MOTION_PANEL_MS, prefersReducedMotion } from '@utils/motion'
import { type CSSProperties, useCallback, useRef, useState } from 'react'

const SWIPE_COMMIT_RATIO = 0.18
const SWIPE_COMMIT_PX = 56
const VELOCITY_THRESHOLD = 0.35

type DragState = {
  pointerId: number
  startX: number
  startTime: number
}

type Options = {
  index: number
  count: number
  enabled: boolean
  onStep: (delta: -1 | 1) => void
}

export function useGalleryCarousel({ index, count, enabled, onStep }: Options) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const activePointersRef = useRef(new Set<number>())
  const pinchActiveRef = useRef(false)
  const [dragPx, setDragPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const cancelDrag = useCallback(() => {
    dragRef.current = null
    setDragPx(0)
    setIsDragging(false)
  }, [])

  const canPrev = index > 0
  const canNext = index < count - 1
  const reduced = prefersReducedMotion()

  const commitSwipe = useCallback(
    (deltaPx: number, elapsedMs: number) => {
      const width = viewportRef.current?.clientWidth ?? 0
      const velocity = width > 0 ? Math.abs(deltaPx) / Math.max(elapsedMs, 1) : 0
      const passedDistance =
        Math.abs(deltaPx) >= SWIPE_COMMIT_PX ||
        (width > 0 && Math.abs(deltaPx) >= width * SWIPE_COMMIT_RATIO)
      const passedVelocity = velocity >= VELOCITY_THRESHOLD

      if (deltaPx > 0 && canPrev && (passedDistance || passedVelocity)) {
        onStep(-1)
      } else if (deltaPx < 0 && canNext && (passedDistance || passedVelocity)) {
        onStep(1)
      }
      setDragPx(0)
      setIsDragging(false)
      dragRef.current = null
    },
    [canNext, canPrev, onStep]
  )

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length > 1) {
        pinchActiveRef.current = true
        cancelDrag()
      }
    },
    [cancelDrag]
  )

  const onTouchEnd = useCallback((event: React.TouchEvent) => {
    if (event.touches.length < 2) {
      pinchActiveRef.current = false
    }
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled || reduced || event.pointerType === 'mouse') return
      if (event.button !== 0) return

      activePointersRef.current.add(event.pointerId)
      if (pinchActiveRef.current || activePointersRef.current.size > 1) {
        cancelDrag()
        return
      }

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startTime: performance.now()
      }
      setIsDragging(true)
      setDragPx(0)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [cancelDrag, enabled, reduced]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (pinchActiveRef.current || activePointersRef.current.size > 1) {
        cancelDrag()
        return
      }

      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      let delta = event.clientX - drag.startX
      const width = viewportRef.current?.clientWidth ?? 0
      if (width > 0) {
        if (delta > 0 && !canPrev) delta *= 0.35
        if (delta < 0 && !canNext) delta *= 0.35
      }
      setDragPx(delta)
    },
    [cancelDrag, canNext, canPrev]
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      activePointersRef.current.delete(event.pointerId)
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      commitSwipe(event.clientX - drag.startX, performance.now() - drag.startTime)
    },
    [commitSwipe]
  )

  const onPointerCancel = useCallback(
    (event: React.PointerEvent) => {
      activePointersRef.current.delete(event.pointerId)
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      commitSwipe(0, 0)
    },
    [commitSwipe]
  )

  const trackStyle: CSSProperties = {
    transform: `translate3d(calc(${-index * 100}% + ${dragPx}px), 0, 0)`,
    transition:
      isDragging || reduced
        ? 'none'
        : `transform ${MOTION_PANEL_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
  }

  return {
    viewportRef,
    trackStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onTouchStart,
    onTouchEnd
  }
}
