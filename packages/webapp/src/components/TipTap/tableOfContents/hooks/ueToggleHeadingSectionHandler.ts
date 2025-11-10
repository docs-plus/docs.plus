import { useCallback } from 'react'
import { toggleHeadingSection } from '../helper'

const useToggleHeadingSectionHandler = (tocId: string, isOpen: boolean) => {
  const toggleHeadingSectionHandler = useCallback(() => {
    if (!tocId) return

    toggleHeadingSection({ id: tocId, open: isOpen })
  }, [tocId, isOpen])
  return toggleHeadingSectionHandler
}

export default useToggleHeadingSectionHandler
