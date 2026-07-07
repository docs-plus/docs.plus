import { prefersReducedMotion } from '@utils/motion'
import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 5
const ZOOM_STEP = 0.15
const CLICK_ZOOM = 2.5
const FIT_SNAP_EPSILON = 0.04
const DOUBLE_TAP_MS = 300
const TAP_SLOP_PX = 30

type Point = { x: number; y: number }

const snapScale = (value: number) => {
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
  return clamped <= MIN_SCALE + FIT_SNAP_EPSILON ? MIN_SCALE : clamped
}

const isFitScale = (value: number) => value <= MIN_SCALE + FIT_SNAP_EPSILON

const resolveTransformHost = (host: HTMLElement | null): HTMLElement | null => {
  if (!host) return null
  const img = host.querySelector('img')
  return img instanceof HTMLElement ? img : host
}

export function useGalleryZoomPan(enabled: boolean, resetKey: string) {
  const hostRef = useRef<HTMLElement | null>(null)
  const scaleRef = useRef(MIN_SCALE)
  const [scale, setScale] = useState(MIN_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [hostElement, setHostElement] = useState<HTMLElement | null>(null)
  const dragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const touchStartRef = useRef<Point | null>(null)
  const singleTapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSingleTapResetTimeout = useCallback(() => {
    if (singleTapResetTimeoutRef.current) {
      clearTimeout(singleTapResetTimeoutRef.current)
      singleTapResetTimeoutRef.current = null
    }
  }, [])

  const applyFit = useCallback(() => {
    clearSingleTapResetTimeout()
    scaleRef.current = MIN_SCALE
    setScale(MIN_SCALE)
    setOffset({ x: 0, y: 0 })
    dragRef.current = null
    pinchRef.current = null
    lastTapRef.current = null
    touchStartRef.current = null
  }, [clearSingleTapResetTimeout])

  useEffect(() => {
    if (!enabled) return
    applyFit()
  }, [applyFit, enabled, resetKey])

  const connectHostRef = useCallback((node: HTMLElement | null) => {
    hostRef.current = node
    setHostElement(node)
  }, [])

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const clamped = snapScale(nextScale)
      if (isFitScale(clamped)) {
        applyFit()
        return
      }

      const host = resolveTransformHost(hostRef.current)
      if (!host) {
        scaleRef.current = clamped
        setScale(clamped)
        return
      }

      const rect = host.getBoundingClientRect()
      const px = clientX - (rect.left + rect.width / 2)
      const py = clientY - (rect.top + rect.height / 2)

      setScale((current) => {
        const next = clamped
        scaleRef.current = next
        if (isFitScale(current)) {
          setOffset({ x: -px * (next - 1), y: -py * (next - 1) })
          return next
        }

        const ratio = next / current
        setOffset((prev) => ({
          x: prev.x * ratio - px * (ratio - 1),
          y: prev.y * ratio - py * (ratio - 1)
        }))
        return next
      })
    },
    [applyFit]
  )

  const handleDoubleTapAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled || prefersReducedMotion()) return
      if (isFitScale(scaleRef.current)) {
        zoomAtPoint(clientX, clientY, CLICK_ZOOM)
      } else {
        applyFit()
      }
    },
    [applyFit, enabled, zoomAtPoint]
  )

  useEffect(() => {
    if (!enabled || !hostElement || prefersReducedMotion()) return

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        dragRef.current = null
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

      if (!isFitScale(scaleRef.current)) {
        event.preventDefault()
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (pinchRef.current && event.touches.length < 2) {
        pinchRef.current = null
        if (isFitScale(scaleRef.current)) applyFit()
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
        clearSingleTapResetTimeout()
        handleDoubleTapAt(x, y)
        return
      }

      lastTapRef.current = { time: now, x, y }

      if (!isFitScale(scaleRef.current)) {
        clearSingleTapResetTimeout()
        singleTapResetTimeoutRef.current = setTimeout(() => {
          singleTapResetTimeoutRef.current = null
          if (!isFitScale(scaleRef.current)) applyFit()
          lastTapRef.current = null
        }, DOUBLE_TAP_MS)
      }
    }

    hostElement.addEventListener('touchstart', onTouchStart, { passive: true })
    hostElement.addEventListener('touchmove', onTouchMove, { passive: false })
    hostElement.addEventListener('touchend', onTouchEnd, { passive: true })
    hostElement.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      clearSingleTapResetTimeout()
      hostElement.removeEventListener('touchstart', onTouchStart)
      hostElement.removeEventListener('touchmove', onTouchMove)
      hostElement.removeEventListener('touchend', onTouchEnd)
      hostElement.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [applyFit, clearSingleTapResetTimeout, enabled, handleDoubleTapAt, hostElement, zoomAtPoint])

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!enabled || prefersReducedMotion()) return
      event.preventDefault()
      event.stopPropagation()
      const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      zoomAtPoint(event.clientX, event.clientY, scaleRef.current + delta)
    },
    [enabled, zoomAtPoint]
  )

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      if (!enabled || prefersReducedMotion() || event.detail > 1) return
      if (isFitScale(scaleRef.current)) return
      event.preventDefault()
      event.stopPropagation()
      applyFit()
    },
    [applyFit, enabled]
  )

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!enabled || prefersReducedMotion()) return
      event.preventDefault()
      event.stopPropagation()
      handleDoubleTapAt(event.clientX, event.clientY)
    },
    [enabled, handleDoubleTapAt]
  )

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled || isFitScale(scaleRef.current) || pinchRef.current) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        origin: { ...offset }
      }
    },
    [enabled, offset]
  )

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    setOffset({
      x: drag.origin.x + (event.clientX - drag.start.x),
      y: drag.origin.y + (event.clientY - drag.start.y)
    })
  }, [])

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }, [])

  const isZoomed = !isFitScale(scale)
  const transform = isZoomed
    ? `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`
    : undefined

  const zoomInAtCenter = useCallback(() => {
    if (!enabled || prefersReducedMotion() || !isFitScale(scaleRef.current)) return
    const host = resolveTransformHost(hostRef.current)
    if (!host) {
      scaleRef.current = CLICK_ZOOM
      setScale(CLICK_ZOOM)
      return
    }
    const rect = host.getBoundingClientRect()
    zoomAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, CLICK_ZOOM)
  }, [enabled, zoomAtPoint])

  return {
    connectHostRef,
    isZoomed,
    transform,
    reset: applyFit,
    zoomInAtCenter,
    onWheel,
    onClick,
    onDoubleClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cursorClass: isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
  }
}
