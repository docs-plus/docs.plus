import { ChunkLoadFallback } from '@components/ChunkLoadFallback'
import { popoverPanelClassName } from '@components/ui/Popover'
import { usePadShareUrl } from '@hooks/usePadShareUrl'
import { twMerge } from '@utils/twMerge'
import dynamic from 'next/dynamic'
import { type CSSProperties, useEffect, useRef, useState } from 'react'

const QrCode = dynamic(() => import('@components/ui/QrCode'), {
  ssr: false,
  loading: (p) => (
    <ChunkLoadFallback
      {...p}
      skeleton={<div className="skeleton aspect-square w-full rounded-none" />}
      className="bg-base-100 px-2 py-4"
    />
  )
})

const MIN_SIZE = 128
const MAX_SIZE = 1024
const KEY_STEP = 16
const TAP_PX = 8
// With Find open the card top is 68px, plus a 2px border and a 14px gap: 84px = 5.25rem.
const ROOM_GAP_PX = 84

const clampSize = (size: number, cap: number) => Math.min(Math.max(Math.round(size), MIN_SIZE), cap)

const clearResizeCursor = () => {
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

interface DragSession {
  startX: number
  startY: number
  startSize: number
  cap: number
  moved: boolean
}

/** The toolbar's QR card for the pad URL. `DesktopEditor` mounts it only while it is shown. */
export function PadQrCode() {
  const shareUrl = usePadShareUrl()
  // Session-only: hiding the card unmounts it, so the next show starts at MIN_SIZE again.
  const [size, setSize] = useState(MIN_SIZE)
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragSession | null>(null)

  // A Private seal or a pad switch can unmount the card in the middle of a drag.
  useEffect(
    () => () => {
      if (drag.current) clearResizeCursor()
    },
    []
  )

  const readCap = () =>
    Math.max(MIN_SIZE, Math.min(MAX_SIZE, (containerRef.current?.clientHeight ?? 0) - ROOM_GAP_PX))

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const cap = readCap()
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      startSize: Math.min(size, cap),
      cap,
      moved: false
    }
    if (cardRef.current) cardRef.current.dataset.dragging = 'true'
    document.body.style.cursor = 'nesw-resize'
    document.body.style.userSelect = 'none'
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = drag.current
    if (!session) return
    const dx = session.startX - event.clientX
    const dy = event.clientY - session.startY
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= TAP_PX) session.moved = true
    // The larger axis wins with its sign, so a drag right or up alone also shrinks.
    const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy
    setSize(clampSize(session.startSize + delta, session.cap))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = drag.current
    drag.current = null
    if (!session) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    // Drop the drag flag first, so a click plays the width tween.
    if (cardRef.current) delete cardRef.current.dataset.dragging
    clearResizeCursor()
    if (session.moved || event.type !== 'pointerup') return
    // A press that moved less than TAP_PX is a click; the start size decides it, not a jitter.
    const cap = readCap()
    setSize(Math.min(session.startSize, cap) === MIN_SIZE ? cap : MIN_SIZE)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const cap = readCap()
    const painted = Math.min(size, cap)
    let next: number
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') next = painted + KEY_STEP
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') next = painted - KEY_STEP
    else if (event.key === 'Home') next = MIN_SIZE
    else if (event.key === 'End') next = cap
    else return
    event.preventDefault()
    setSize(clampSize(next, cap))
  }

  // A size container over the pad row, above docked chat, so the card never runs into chat (#377).
  // The 13.5rem show gate holds MIN_SIZE plus the 5.25rem worst case; move it if MIN_SIZE changes.
  // The painted code caps at 100cqh - 5.25rem, so docked chat or Find shrinks it until room returns.
  return (
    <div
      ref={containerRef}
      className="[container-type:size] pointer-events-none absolute inset-x-0 top-0 bottom-[var(--chat-panel-height,0px)]">
      <div
        ref={cardRef}
        data-testid="pad-qr-code"
        className="group/padqr pointer-events-auto absolute top-3.5 right-[calc(var(--scrollbar-size-thin)+0.875rem)] z-50 hidden group-has-[.caret-find-bar]/padcol:top-17 [@container_(min-height:13.5rem)]:block">
        {/* The svg carries the image role, so a failed chunk's Try again stays reachable. */}
        <div
          className={twMerge(popoverPanelClassName, 'w-auto')}
          style={{ '--pad-qr-size': `${size}px` } as CSSProperties}>
          {/* The light margin is padding, not a module-sized quiet zone, so a large code keeps a thin margin. */}
          <div className="w-[min(var(--pad-qr-size),calc(100cqh-5.25rem))] bg-[var(--qr-plate)] p-[clamp(0.75rem,calc(var(--pad-qr-size)*0.04),1.5rem)] group-data-[dragging]/padqr:transition-none motion-safe:transition-[width] motion-safe:duration-[var(--motion-panel)] motion-safe:ease-out">
            <QrCode
              value={shareUrl}
              quietZone={0}
              className="w-full"
              label={`QR code for ${shareUrl.replace(/^https?:\/\//, '')}`}
            />
          </div>
        </div>
        <div
          role="slider"
          tabIndex={0}
          data-testid="pad-qr-resize"
          aria-label="Resize QR code"
          aria-valuemin={MIN_SIZE}
          aria-valuemax={MAX_SIZE}
          aria-valuenow={size}
          aria-valuetext={`${size} pixels`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={onKeyDown}
          className="rounded-field focus-visible:ring-primary absolute -bottom-3 -left-3 size-6 cursor-nesw-resize touch-none opacity-0 transition-opacity duration-[var(--motion-overlay-in)] group-hover/padqr:opacity-100 group-data-[dragging]/padqr:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none">
          {/* Two strokes in the bottom-left quiet zone, inside the panel's rounded corner. */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="size-6 stroke-[var(--qr-ink)]">
            <path d="M16.5 5.3 18.7 7.5M17.6 1.5 22.5 6.4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
