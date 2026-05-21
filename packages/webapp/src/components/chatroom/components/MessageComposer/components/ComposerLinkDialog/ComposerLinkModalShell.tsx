import { syncVisualViewportToCssVars } from '@utils/visualViewportCss'
import { motion } from 'motion/react'
import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const BACKDROP_TRANSITION = { duration: 0.15, ease: 'easeOut' } as const
const CARD_TRANSITION = { duration: 0.18, ease: [0.16, 1, 0.3, 1] } as const

type Props = {
  children: ReactNode
  titleId: string
  onBackdropClick: () => void
}

export function ComposerLinkModalShell({ children, titleId, onBackdropClick }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    syncVisualViewportToCssVars()
  }, [])

  // Tab/Shift+Tab wrap inside the card. Initial focus is owned by each dialog
  // so iOS-specific cadence (e.g. edit-from-preview 50ms defer) isn't overridden.
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const focusables = () =>
      Array.from(
        card.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('aria-hidden'))

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    card.addEventListener('keydown', onKey)
    return () => card.removeEventListener('keydown', onKey)
  }, [])

  if (typeof document === 'undefined') return null

  const viewportStyle = {
    top: 'var(--visual-viewport-offset-top, 0px)',
    left: 'var(--visual-viewport-offset-left, 0px)',
    width: 'var(--visual-viewport-width, 100%)',
    height: 'var(--visual-viewport-height, 100dvh)'
  } as const

  return createPortal(
    <div className="fixed z-[60] overflow-y-auto" style={viewportStyle}>
      <motion.div
        className="absolute inset-0 bg-black/40"
        role="presentation"
        onClick={onBackdropClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={BACKDROP_TRANSITION}
      />
      <div className="pointer-events-none relative flex min-h-full items-center justify-center p-4">
        <motion.div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="bg-base-100 text-base-content border-base-300 pointer-events-auto relative w-full max-w-sm shrink-0 rounded-lg border p-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={CARD_TRANSITION}>
          {children}
        </motion.div>
      </div>
    </div>,
    document.body
  )
}
