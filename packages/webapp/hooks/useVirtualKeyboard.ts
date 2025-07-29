import { useEffect } from 'react'
import { useStore } from '@stores'

const useVirtualKeyboard = () => {
  const { setKeyboardOpen, setKeyboardHeight, setVirtualKeyboardState } = useStore((state) => state)

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

      setKeyboardOpen(isKeyboardOpen)
      setKeyboardHeight(keyboardHeight)
      setVirtualKeyboardState(isKeyboardOpen ? 'open' : 'closed')
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
}

export default useVirtualKeyboard
