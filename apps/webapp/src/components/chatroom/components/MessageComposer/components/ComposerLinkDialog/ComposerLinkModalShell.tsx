import CloseButton from '@components/ui/CloseButton'
import { modalBackdropClassName, modalPanelFrameClassName } from '@components/ui/Dialog'
import { MOTION_DIALOG_IN_MS, MOTION_DIALOG_OUT_MS } from '@utils/motion'
import { syncVisualViewportToCssVars } from '@utils/visualViewportCss'
import { motion, useIsPresent } from 'motion/react'
import { type ReactNode, useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Same timing as the house Dialog in ui/Dialog.tsx: ease-out on enter, ease-in on exit.
const BACKDROP_TRANSITION = { duration: MOTION_DIALOG_OUT_MS / 1000, ease: 'easeOut' } as const
const CARD_TRANSITION = { duration: MOTION_DIALOG_IN_MS / 1000, ease: 'easeOut' } as const
const EXIT_TRANSITION = { duration: MOTION_DIALOG_OUT_MS / 1000, ease: 'easeIn' } as const

// Literal classes for Tailwind. The width ladder: an action list is `sm`, a form is `md`.
const WIDTH_CLASS = { sm: 'max-w-sm', md: 'max-w-md' } as const

type Props = {
  children: ReactNode
  title: string
  onBackdropClick: () => void
  size?: keyof typeof WIDTH_CLASS
}

export function ComposerLinkModalShell({ children, title, onBackdropClick, size = 'sm' }: Props) {
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const isPresent = useIsPresent()

  useLayoutEffect(() => {
    syncVisualViewportToCssVars()
    const vv = window.visualViewport
    if (!vv) return
    const onViewportChange = () => syncVisualViewportToCssVars()
    vv.addEventListener('resize', onViewportChange)
    vv.addEventListener('scroll', onViewportChange)
    return () => {
      vv.removeEventListener('resize', onViewportChange)
      vv.removeEventListener('scroll', onViewportChange)
    }
  }, [])

  // Focus that returns to the composer editor is how a dialog hands the keyboard back,
  // so the trap lets it stay. An exiting shell drops its trap: AnimatePresence
  // keeps it mounted beside the next dialog during the exit tween.
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card || !isPresent) return
    const focusables = () =>
      Array.from(
        card.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('aria-hidden'))

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof Element) || card.contains(target)) return
      if (target.closest('[data-chat-composer-surface] .ProseMirror')) return
      const items = focusables()
      items[0]?.focus()
    }

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
    document.addEventListener('focusin', onFocusIn, true)
    return () => {
      card.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn, true)
    }
  }, [isPresent])

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
        className={`absolute inset-0 ${modalBackdropClassName}`}
        role="presentation"
        onClick={onBackdropClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: EXIT_TRANSITION }}
        transition={BACKDROP_TRANSITION}
      />
      <div className="pointer-events-none grid h-full min-h-0 place-items-center p-4">
        <motion.div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`${modalPanelFrameClassName} text-base-content pointer-events-auto relative flex w-full ${WIDTH_CLASS[size]} shrink-0 flex-col gap-4 p-6`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96, transition: EXIT_TRANSITION }}
          transition={CARD_TRANSITION}>
          <div className="flex items-start justify-between gap-2">
            <h2 id={titleId} className="text-base-content text-xl font-semibold">
              {title}
            </h2>
            <CloseButton onClick={onBackdropClick} />
          </div>
          {children}
        </motion.div>
      </div>
    </div>,
    document.body
  )
}
