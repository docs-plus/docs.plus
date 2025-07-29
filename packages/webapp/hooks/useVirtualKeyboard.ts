import { useEffect, useRef } from 'react'
import { useStore } from '@stores'

const useVirtualKeyboard = () => {
  const { setKeyboardOpen, setKeyboardHeight, setVirtualKeyboardState } = useStore((state) => state)
  const previousIsOpenRef = useRef<boolean | null>(null)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    const visualViewport = window.visualViewport

    if (!visualViewport) {
      return
    }

    const handleViewportChange = () => {
      const windowHeight = window.innerHeight
      const viewportHeight = visualViewport.height
      const keyboardHeight = windowHeight - viewportHeight
      const isKeyboardOpen = keyboardHeight > 0
      const previousIsOpen = previousIsOpenRef.current

      setKeyboardOpen(isKeyboardOpen)
      setKeyboardHeight(keyboardHeight)

      // Clear any existing transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }

      // Determine state based on current vs previous
      if (previousIsOpen === null) {
        // Initial state - no transition
        setVirtualKeyboardState(isKeyboardOpen ? 'open' : 'closed')
      } else if (previousIsOpen === false && isKeyboardOpen === true) {
        // Keyboard is opening
        setVirtualKeyboardState('opening')
        transitionTimeoutRef.current = setTimeout(() => {
          setVirtualKeyboardState('open')
        }, 300) // Typical keyboard animation duration
      } else if (previousIsOpen === true && isKeyboardOpen === false) {
        // Keyboard is closing
        setVirtualKeyboardState('closing')
        transitionTimeoutRef.current = setTimeout(() => {
          setVirtualKeyboardState('closed')
        }, 300)
      } else {
        // No state change - maintain current state
        setVirtualKeyboardState(isKeyboardOpen ? 'open' : 'closed')
      }

      previousIsOpenRef.current = isKeyboardOpen
    }

    // Initial check
    handleViewportChange()

    // Listen for viewport changes
    visualViewport.addEventListener('resize', handleViewportChange)
    visualViewport.addEventListener('scroll', handleViewportChange)

    return () => {
      visualViewport.removeEventListener('resize', handleViewportChange)
      visualViewport.removeEventListener('scroll', handleViewportChange)
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [])
}

export default useVirtualKeyboard
