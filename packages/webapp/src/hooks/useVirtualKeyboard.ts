import { useEffect, useRef } from 'react'
import { useStore } from '@stores'

/**
 * Tracks virtual keyboard state for mobile devices.
 * Uses 300ms debounce to wait for full iOS keyboard animation completion.
 *
 * CRITICAL: This hook only tracks state - layout is handled by CSS + _app.tsx
 */
const useVirtualKeyboard = () => {
  const { setKeyboardOpen, setKeyboardHeight, setVirtualKeyboardState } = useStore((state) => state)
  const previousIsOpenRef = useRef<boolean | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return

    // Threshold to consider keyboard "open" (accounts for browser chrome variations)
    const KEYBOARD_THRESHOLD = 100
    // iOS keyboard animation takes ~300-400ms
    const DEBOUNCE_MS = 300

    const handleViewportChange = () => {
      const windowHeight = window.innerHeight
      const viewportHeight = visualViewport.height
      const keyboardHeight = Math.max(0, windowHeight - viewportHeight)
      const isKeyboardOpen = keyboardHeight > KEYBOARD_THRESHOLD

      // Debounce ALL state changes to prevent rapid updates during animation
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        const previousIsOpen = previousIsOpenRef.current

        // Only update if state actually changed
        if (previousIsOpen !== isKeyboardOpen) {
          setKeyboardHeight(keyboardHeight)
          setKeyboardOpen(isKeyboardOpen)
          setVirtualKeyboardState(isKeyboardOpen ? 'open' : 'closed')
          previousIsOpenRef.current = isKeyboardOpen
        }
      }, DEBOUNCE_MS)
    }

    // Initial check
    handleViewportChange()

    // Only listen to resize events - scroll events cause glitches!
    visualViewport.addEventListener('resize', handleViewportChange)

    return () => {
      visualViewport.removeEventListener('resize', handleViewportChange)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [setKeyboardOpen, setKeyboardHeight, setVirtualKeyboardState])
}

export default useVirtualKeyboard
