import { useCallback } from 'react'
import { toggleHeadingSection } from '../utils'

const useToggleHeadingSectionHandler = (tocId: string) => {
  const toggleHeadingSectionHandler = useCallback(() => {
    if (!tocId) return

    toggleHeadingSection(tocId)
  }, [tocId])
  return toggleHeadingSectionHandler
}

export default useToggleHeadingSectionHandler
