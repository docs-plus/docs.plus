import { useSheetStore, useStore } from '@stores'
import { useEffect } from 'react'
import useKeyboardHeight from '@hooks/useKeyboardHeight'
import { applyStyles } from '../helpers/domUtils'

type Props = {
  children: React.ReactNode
}

const SHEET_STYLES = {
  keyboardOpen: {
    height: '100%',
    borderRadius: '0'
  },
  keyboardClosed: {
    height: 'calc(100% - env(safe-area-inset-top) - 34px)',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px'
  }
} as const

export const MobileWrapper = ({ children }: Props) => {
  const { sheetContainerRef } = useSheetStore()
  const { isOpen: isKeyboardOpen } = useKeyboardHeight()
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  useEffect(() => {
    if (!sheetContainerRef || !isMobile) return

    const styles = isKeyboardOpen ? SHEET_STYLES.keyboardOpen : SHEET_STYLES.keyboardClosed
    applyStyles(sheetContainerRef, styles)
  }, [isMobile, isKeyboardOpen, sheetContainerRef])

  return <div>{children}</div>
}
