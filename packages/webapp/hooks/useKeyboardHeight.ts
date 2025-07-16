import { useEffect, useState } from 'react'

interface KeyboardState {
  isOpen: boolean
  height: number
  viewportHeight: number
}

const useKeyboardHeight = (): KeyboardState => {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isOpen: false,
    height: 0,
    viewportHeight: window.innerHeight
  })

  useEffect(() => {
    const visualViewport = window.visualViewport

    if (!visualViewport) {
      // Fallback for browsers without Visual Viewport API
      return
    }

    const handleViewportChange = () => {
      const windowHeight = window.innerHeight
      const viewportHeight = visualViewport.height
      const keyboardHeight = windowHeight - viewportHeight
      const isKeyboardOpen = keyboardHeight > 0

      setKeyboardState({
        isOpen: isKeyboardOpen,
        height: keyboardHeight,
        viewportHeight: viewportHeight
      })
    }

    // Initial check
    handleViewportChange()

    // Listen for viewport changes
    visualViewport.addEventListener('resize', handleViewportChange)
    visualViewport.addEventListener('scroll', handleViewportChange)

    return () => {
      visualViewport.removeEventListener('resize', handleViewportChange)
      visualViewport.removeEventListener('scroll', handleViewportChange)
    }
  }, [])

  return keyboardState
}

export default useKeyboardHeight
