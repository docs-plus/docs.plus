import {
  CLICK_ZOOM,
  DOUBLE_TAP_MS,
  FIT_ZOOM_STATE,
  isFitScale,
  MIN_SCALE,
  TAP_SLOP_PX,
  ZOOM_STEP,
  type ZoomPoint,
  zoomStateAtPoint
} from '@components/chatroom/utils/galleryZoomMath'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Image lightbox zoom/pan. Transform is applied to the media child; layout math
 * always measures the untransformed host so zoom-at-point stays stable.
 */
export function useGalleryZoomPan(enabled: boolean, resetKey: string) {
  const hostRef = useRef<HTMLElement | null>(null)
  const scaleRef = useRef(MIN_SCALE)
  const offsetRef = useRef<ZoomPoint>({ x: 0, y: 0 })
  const [scale, setScale] = useState(MIN_SCALE)
  const [offset, setOffset] = useState<ZoomPoint>({ x: 0, y: 0 })
  const [hostElement, setHostElement] = useState<HTMLElement | null>(null)
  const dragRef = useRef<{ pointerId: number; start: ZoomPoint; origin: ZoomPoint } | null>(null)
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const touchStartRef = useRef<ZoomPoint | null>(null)
  const touchPanRef = useRef<{ start: ZoomPoint; origin: ZoomPoint } | null>(null)
  const pendingClickRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClickRef = useRef(false)
  const mouseDragMovedRef = useRef(false)

  const clearPendingClick = useCallback(() => {
    if (pendingClickRef.current) {
      clearTimeout(pendingClickRef.current)
      pendingClickRef.current = null
    }
  }, [])

  const commitOffset = useCallback((next: ZoomPoint) => {
    offsetRef.current = next
    setOffset(next)
  }, [])

  const commitScale = useCallback((next: number) => {
    scaleRef.current = next
    setScale(next)
  }, [])

  const applyFit = useCallback(() => {
    clearPendingClick()
    commitScale(FIT_ZOOM_STATE.scale)
    commitOffset(FIT_ZOOM_STATE.offset)
    dragRef.current = null
    pinchRef.current = null
    touchPanRef.current = null
    lastTapRef.current = null
    touchStartRef.current = null
  }, [clearPendingClick, commitOffset, commitScale])

  useEffect(() => {
    if (!enabled) return
    applyFit()
  }, [applyFit, enabled, resetKey])

  useEffect(() => () => clearPendingClick(), [clearPendingClick])

  const connectHostRef = useCallback((node: HTMLElement | null) => {
    hostRef.current = node
    setHostElement(node)
  }, [])

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const host = hostRef.current
      if (!host) {
        const next = zoomStateAtPoint(
          { scale: scaleRef.current, offset: offsetRef.current },
          { x: 0, y: 0 },
          nextScale
        )
        if (isFitScale(next.scale)) {
          applyFit()
          return
        }
        commitScale(next.scale)
        return
      }

      const rect = host.getBoundingClientRect()
      const next = zoomStateAtPoint(
        { scale: scaleRef.current, offset: offsetRef.current },
        {
          x: clientX - (rect.left + rect.width / 2),
          y: clientY - (rect.top + rect.height / 2)
        },
        nextScale
      )

      if (isFitScale(next.scale)) {
        applyFit()
        return
      }

      commitScale(next.scale)
      commitOffset(next.offset)
    },
    [applyFit, commitOffset, commitScale]
  )

  const toggleZoomAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled) return
      if (isFitScale(scaleRef.current)) {
        zoomAtPoint(clientX, clientY, CLICK_ZOOM)
      } else {
        applyFit()
      }
    },
    [applyFit, enabled, zoomAtPoint]
  )

  useEffect(() => {
    if (!enabled || !hostElement) return

    const onTouchStart = (event: TouchEvent) => {
      clearPendingClick()

      if (event.touches.length === 2) {
        dragRef.current = null
        touchPanRef.current = null
        lastTapRef.current = null
        touchStartRef.current = null
        const [a, b] = [event.touches[0]!, event.touches[1]!]
        pinchRef.current = {
          startDistance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          startScale: scaleRef.current
        }
        return
      }

      if (event.touches.length === 1) {
        const touch = event.touches[0]!
        touchStartRef.current = { x: touch.clientX, y: touch.clientY }
        if (!isFitScale(scaleRef.current)) {
          touchPanRef.current = {
            start: { x: touch.clientX, y: touch.clientY },
            origin: { ...offsetRef.current }
          }
        }
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current
      if (event.touches.length === 2 && pinch) {
        event.preventDefault()
        const [a, b] = [event.touches[0]!, event.touches[1]!]
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
        if (pinch.startDistance <= 0) return
        const midX = (a.clientX + b.clientX) / 2
        const midY = (a.clientY + b.clientY) / 2
        zoomAtPoint(midX, midY, pinch.startScale * (distance / pinch.startDistance))
        return
      }

      const pan = touchPanRef.current
      if (event.touches.length === 1 && pan && !isFitScale(scaleRef.current)) {
        event.preventDefault()
        const touch = event.touches[0]!
        if (
          touchStartRef.current &&
          Math.hypot(
            touch.clientX - touchStartRef.current.x,
            touch.clientY - touchStartRef.current.y
          ) > TAP_SLOP_PX
        ) {
          touchStartRef.current = null
          lastTapRef.current = null
        }
        commitOffset({
          x: pan.origin.x + (touch.clientX - pan.start.x),
          y: pan.origin.y + (touch.clientY - pan.start.y)
        })
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (pinchRef.current && event.touches.length < 2) {
        pinchRef.current = null
        if (isFitScale(scaleRef.current)) applyFit()
      }

      if (event.touches.length === 0) {
        touchPanRef.current = null
      }

      if (event.touches.length > 0) return

      const touch = event.changedTouches[0]
      const start = touchStartRef.current
      touchStartRef.current = null
      if (!touch || !start) return

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (Math.hypot(dx, dy) > TAP_SLOP_PX) {
        lastTapRef.current = null
        return
      }

      const now = Date.now()
      const { clientX: x, clientY: y } = touch
      const last = lastTapRef.current

      if (
        last &&
        now - last.time < DOUBLE_TAP_MS &&
        Math.hypot(x - last.x, y - last.y) < TAP_SLOP_PX
      ) {
        lastTapRef.current = null
        toggleZoomAt(x, y)
        return
      }

      lastTapRef.current = { time: now, x, y }
    }

    hostElement.addEventListener('touchstart', onTouchStart, { passive: true })
    hostElement.addEventListener('touchmove', onTouchMove, { passive: false })
    hostElement.addEventListener('touchend', onTouchEnd, { passive: true })
    hostElement.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      hostElement.removeEventListener('touchstart', onTouchStart)
      hostElement.removeEventListener('touchmove', onTouchMove)
      hostElement.removeEventListener('touchend', onTouchEnd)
      hostElement.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [applyFit, clearPendingClick, commitOffset, enabled, hostElement, toggleZoomAt, zoomAtPoint])

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!enabled) return
      event.preventDefault()
      event.stopPropagation()
      const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      zoomAtPoint(event.clientX, event.clientY, scaleRef.current + delta)
    },
    [enabled, zoomAtPoint]
  )

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      if (!enabled || event.detail > 1) return
      if (!(event.target instanceof HTMLImageElement)) return
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      event.preventDefault()
      event.stopPropagation()

      const { clientX, clientY } = event
      clearPendingClick()
      pendingClickRef.current = setTimeout(() => {
        pendingClickRef.current = null
        toggleZoomAt(clientX, clientY)
      }, DOUBLE_TAP_MS)
    },
    [clearPendingClick, enabled, toggleZoomAt]
  )

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!enabled) return
      if (!(event.target instanceof HTMLImageElement)) return
      event.preventDefault()
      event.stopPropagation()
      clearPendingClick()
      toggleZoomAt(event.clientX, event.clientY)
    },
    [clearPendingClick, enabled, toggleZoomAt]
  )

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled || event.pointerType !== 'mouse') return
      if (isFitScale(scaleRef.current) || pinchRef.current) return
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      mouseDragMovedRef.current = false
      dragRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        origin: { ...offsetRef.current }
      }
    },
    [enabled]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      event.preventDefault()
      const dx = event.clientX - drag.start.x
      const dy = event.clientY - drag.start.y
      if (Math.hypot(dx, dy) > TAP_SLOP_PX) {
        mouseDragMovedRef.current = true
        clearPendingClick()
      }
      commitOffset({
        x: drag.origin.x + dx,
        y: drag.origin.y + dy
      })
    },
    [clearPendingClick, commitOffset]
  )

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      if (mouseDragMovedRef.current) {
        suppressClickRef.current = true
        mouseDragMovedRef.current = false
      }
    }
  }, [])

  const isZoomed = !isFitScale(scale)
  const transform = isZoomed
    ? `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`
    : undefined

  const zoomAtHostCenter = useCallback(
    (nextScale: number) => {
      if (!enabled) return
      const host = hostRef.current
      if (!host) {
        const next = zoomStateAtPoint(
          { scale: scaleRef.current, offset: offsetRef.current },
          { x: 0, y: 0 },
          nextScale
        )
        if (isFitScale(next.scale)) applyFit()
        else commitScale(next.scale)
        return
      }
      const rect = host.getBoundingClientRect()
      zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, nextScale)
    },
    [applyFit, commitScale, enabled, zoomAtPoint]
  )

  /** Toolbar one-shot: fit → ~2.5× at center. No-op when already zoomed. */
  const zoomInAtCenter = useCallback(() => {
    if (!enabled || !isFitScale(scaleRef.current)) return
    zoomAtHostCenter(CLICK_ZOOM)
  }, [enabled, zoomAtHostCenter])

  /** Keyboard `+`/`=` / wheel-sized step at center. */
  const zoomStepInAtCenter = useCallback(() => {
    if (!enabled) return
    zoomAtHostCenter(scaleRef.current + ZOOM_STEP)
  }, [enabled, zoomAtHostCenter])

  /** Keyboard `-`: step out at center; snaps to fit near 1×. */
  const zoomStepOutAtCenter = useCallback(() => {
    if (!enabled || isFitScale(scaleRef.current)) return
    zoomAtHostCenter(scaleRef.current - ZOOM_STEP)
  }, [enabled, zoomAtHostCenter])

  const panBy = useCallback(
    (dx: number, dy: number) => {
      if (!enabled || isFitScale(scaleRef.current)) return
      const prev = offsetRef.current
      commitOffset({ x: prev.x + dx, y: prev.y + dy })
    },
    [commitOffset, enabled]
  )

  return {
    connectHostRef,
    isZoomed,
    transform,
    reset: applyFit,
    zoomInAtCenter,
    zoomStepInAtCenter,
    zoomStepOutAtCenter,
    panBy,
    onWheel,
    onClick,
    onDoubleClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cursorClass: isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
  }
}
