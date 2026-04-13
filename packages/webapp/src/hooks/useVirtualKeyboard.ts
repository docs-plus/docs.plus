import {
  applyVirtualKeyboardToStore,
  resetVirtualKeyboardSessionBaseline
} from '@utils/virtualKeyboardMetrics'
import { useEffect, useRef } from 'react'

/**
 * Tracks virtual keyboard state for mobile devices.
 * Coalesces with requestAnimationFrame (same frame as layout) — no long debounce, so
 * ToolbarMobile mount and flex layout do not drift after rapid keyboard cycles.
 *
 * CRITICAL: This hook only tracks state - layout is handled by CSS + AppProviders.
 */
const useVirtualKeyboard = () => {
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return

    const handleViewportChange = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        applyVirtualKeyboardToStore()
      })
    }

    applyVirtualKeyboardToStore()

    const onOrientation = () => {
      resetVirtualKeyboardSessionBaseline()
      applyVirtualKeyboardToStore()
    }

    visualViewport.addEventListener('resize', handleViewportChange)
    // iOS Safari: keyboard / URL bar shifts sometimes update offset via `scroll` without a `resize`.
    visualViewport.addEventListener('scroll', handleViewportChange)
    window.addEventListener('orientationchange', onOrientation)

    return () => {
      visualViewport.removeEventListener('resize', handleViewportChange)
      visualViewport.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('orientationchange', onOrientation)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])
}

export default useVirtualKeyboard
