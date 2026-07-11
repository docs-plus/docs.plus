import { type MouseEvent, type MouseEventHandler, type TouchEvent, useRef } from 'react'

/** iOS synthesizes a "ghost" click ~300ms after a tap; ignore clicks within this window. */
const GHOST_CLICK_MS = 700

/**
 * Reconciles touch + click into one `onPress` so buttons stay VoiceOver-activatable (double-tap fires a
 * synthesized click) without double-firing on real taps. A self-expiring timestamp — not a sticky latch —
 * never wrongly swallows a later click; `preventDefault` applied. Pass `onPress` OR `onClick`, not both.
 */
export function useTouchPress(
  onPress?: (event: MouseEvent | TouchEvent) => void,
  onClick?: MouseEventHandler<HTMLButtonElement>
) {
  const lastTouchRef = useRef(0)

  const handleTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    event.preventDefault()
    lastTouchRef.current = Date.now()
    onPress?.(event)
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (Date.now() - lastTouchRef.current < GHOST_CLICK_MS) return
    onPress?.(event)
    onClick?.(event)
  }

  return { handleTouchEnd, handleClick }
}
