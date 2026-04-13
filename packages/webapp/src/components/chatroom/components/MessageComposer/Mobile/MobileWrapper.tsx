type Props = {
  children: React.ReactNode
}

/**
 * Chat composer shell on mobile. Document pad uses `--visual-viewport-height` + `syncVisualViewportToCssVars`
 * for keyboard-safe layout; this wrapper stays a pass-through. Older experiments toggled sheet height from
 * `isKeyboardOpen` — left commented to avoid fighting `react-modal-sheet` + global mobile shell CSS.
 */
// const SHEET_STYLES = {
//   keyboardOpen: {
//     height: '100%',
//     borderRadius: '0'
//   },
//   keyboardClosed: {
//     height: 'calc(100% - env(safe-area-inset-top) - 34px)',
//     borderTopLeftRadius: '8px',
//     borderTopRightRadius: '8px'
//   }
// } as const

export const MobileWrapper = ({ children }: Props) => {
  // const { sheetContainerRef } = useSheetStore()
  // const { isKeyboardOpen } = useStore((state) => state)
  // const {
  //   settings: {
  //     editor: { isMobile }
  //   }
  // } = useStore((state) => state)

  // useEffect(() => {
  //   if (!sheetContainerRef || !isMobile) return

  //   const styles = isKeyboardOpen ? SHEET_STYLES.keyboardOpen : SHEET_STYLES.keyboardClosed
  //   applyStyles(sheetContainerRef, styles)
  // }, [isMobile, isKeyboardOpen, sheetContainerRef])

  return <div>{children}</div>
}
