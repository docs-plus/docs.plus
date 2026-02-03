import { useCallback, useState } from 'react'

/**
 * Manages menu visibility and animation states for long press menu
 */
export const useMenuVisibility = () => {
  const [isLongPressMenuVisible, setIsLongPressMenuVisible] = useState(false)
  const [isMenuEnterAnimationActive, setIsMenuEnterAnimationActive] = useState(false)

  const showMenu = useCallback(() => {
    setIsLongPressMenuVisible(true)
    setIsMenuEnterAnimationActive(true)
  }, [])

  const hideMenu = useCallback(() => {
    setIsMenuEnterAnimationActive(false)
    // Delay hiding to allow exit animation
    setTimeout(() => {
      setIsLongPressMenuVisible(false)
    }, 200) // Match animation duration
  }, [])

  return {
    isLongPressMenuVisible,
    isMenuEnterAnimationActive,
    showMenu,
    hideMenu
  }
}
