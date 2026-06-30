import { useStore } from '@stores'
import {
  applyVirtualKeyboardToStore,
  resetVirtualKeyboardSessionBaseline
} from '@utils/virtualKeyboardMetrics'
import { useEffect, useRef } from 'react'

export interface UseVirtualKeyboardOptions {
  /** When set, tracking runs only while this media query matches. */
  activeMq?: string
  /** Reset global keyboard store when inactive or on unmount. */
  clearStoreOnDisable?: boolean
}

/**
 * Tracks virtual keyboard state for mobile devices.
 * Coalesces with requestAnimationFrame (same frame as layout) — no long debounce, so
 * ToolbarMobile mount and flex layout do not drift after rapid keyboard cycles.
 *
 * CRITICAL: This hook only tracks state - layout is handled by CSS + AppProviders.
 */
const useVirtualKeyboard = (options: UseVirtualKeyboardOptions = {}) => {
  const { activeMq, clearStoreOnDisable = false } = options
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return

    const gateMq = activeMq ? window.matchMedia(activeMq) : null

    const clearStore = () => {
      if (clearStoreOnDisable) {
        useStore.getState().setKeyboardOpen(false)
      }
    }

    const shouldTrack = () => !gateMq || gateMq.matches

    const scheduleApply = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        if (!shouldTrack()) {
          clearStore()
          return
        }
        applyVirtualKeyboardToStore()
      })
    }

    const onOrientation = () => {
      resetVirtualKeyboardSessionBaseline()
      scheduleApply()
    }

    const onMqChange = () => scheduleApply()

    if (shouldTrack()) {
      applyVirtualKeyboardToStore()
    } else {
      clearStore()
    }

    visualViewport.addEventListener('resize', scheduleApply)
    // iOS Safari: keyboard / URL bar shifts sometimes update offset via `scroll` without a `resize`.
    visualViewport.addEventListener('scroll', scheduleApply)
    window.addEventListener('orientationchange', onOrientation)
    gateMq?.addEventListener('change', onMqChange)

    return () => {
      visualViewport.removeEventListener('resize', scheduleApply)
      visualViewport.removeEventListener('scroll', scheduleApply)
      window.removeEventListener('orientationchange', onOrientation)
      gateMq?.removeEventListener('change', onMqChange)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      clearStore()
    }
  }, [activeMq, clearStoreOnDisable])
}

export default useVirtualKeyboard
