import { MOTION_PANEL_MS, prefersReducedMotion } from '@utils/motion'
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseEntryExitTransitionOptions {
  durationMs?: number
}

/**
 * Mount/unmount state for CSS transitions: double-rAF on enter so the hidden
 * from-frame paints, transitionend on exit with a fallback timer (transitionend
 * never fires under display:none). Reduced motion skips straight to final states.
 */
export const useEntryExitTransition = <T extends HTMLElement = HTMLDivElement>({
  durationMs = MOTION_PANEL_MS
}: UseEntryExitTransitionOptions = {}) => {
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)
  const nodeRef = useRef<T | null>(null)
  const cancelPendingRef = useRef<(() => void) | null>(null)

  const cancelPending = useCallback(() => {
    cancelPendingRef.current?.()
    cancelPendingRef.current = null
  }, [])

  const show = useCallback(() => {
    cancelPending()
    setMounted(true)
    if (prefersReducedMotion()) {
      setShown(true)
      return
    }
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setShown(true))
    })
    cancelPendingRef.current = () => cancelAnimationFrame(raf)
  }, [cancelPending])

  const hide = useCallback(() => {
    cancelPending()
    setShown(false)
    if (prefersReducedMotion()) {
      setMounted(false)
      return
    }
    const node = nodeRef.current
    const finish = () => {
      cancelPending()
      setMounted(false)
    }
    // Child transitions bubble transitionend too — only the host node ends the exit.
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === node) finish()
    }
    const fallback = setTimeout(finish, durationMs + 50)
    node?.addEventListener('transitionend', onTransitionEnd)
    cancelPendingRef.current = () => {
      clearTimeout(fallback)
      node?.removeEventListener('transitionend', onTransitionEnd)
    }
  }, [cancelPending, durationMs])

  useEffect(() => cancelPending, [cancelPending])

  return { mounted, shown, show, hide, nodeRef }
}
