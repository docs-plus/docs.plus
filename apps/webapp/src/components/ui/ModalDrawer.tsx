import {
  FloatingFocusManager,
  useDismiss,
  useFloating,
  useInteractions,
  useRole
} from '@floating-ui/react'
import { useHistoryDismiss } from '@hooks/useHistoryDismiss'
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useState
} from 'react'
import { twMerge } from 'tailwind-merge'

interface ModalDrawerProps {
  modalId?: string
  className?: string
  contentClassName?: string
  children: React.ReactNode
  onModalStateChange?: (isOpen: boolean) => void
  width?: number
  position?: 'left' | 'right'
  /** Accessible name of the open drawer; required so no drawer ships as an unnamed dialog. */
  ariaLabel: string
}

interface ModalContextType {
  close: () => void
}

export const ModalContext = createContext<ModalContextType | null>(null)

/** Optional close handle. Shared TOC rows call this on desktop, where no drawer exists. */
export const useModal = () => {
  return useContext(ModalContext)
}

/** Drawer children only — throws when `ModalContext` is missing (no silent `undefined`). */
export function useModalDrawerClose(): () => void {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModalDrawerClose must be used within ModalDrawer')
  }
  return context.close
}

/** The drawer toggle. A bare `<label htmlFor>` is not keyboard-operable, and close returns focus here. */
export function ModalDrawerOpener({
  modalId,
  ariaLabel,
  className,
  children
}: {
  modalId: string
  ariaLabel: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={modalId}
      aria-label={ariaLabel}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.currentTarget.click()
        }
      }}
      className={className}>
      {children}
    </label>
  )
}

export type ModalDrawerHandle = {
  check: () => void
  uncheck: () => void
}

export const ModalDrawer = forwardRef<ModalDrawerHandle, ModalDrawerProps>(
  (
    { modalId = 'left_to_right_modal', children, onModalStateChange, position = 'left', ariaLabel },
    ref
  ) => {
    const checkboxRef = React.useRef<HTMLInputElement>(null)
    const [isOpen, setIsOpen] = useState(false)
    const { refs, context } = useFloating({
      open: isOpen,
      onOpenChange: (open) => {
        if (!open) modalControl.close()
      }
    })
    const { getFloatingProps } = useInteractions([
      useDismiss(context, { outsidePress: false }),
      useRole(context, { role: 'dialog' })
    ])

    // Synchronous, not the focus manager's microtask: a caller that closes the drawer and then
    // focuses something else in the same tap (TocModal Find) must keep that focus.
    const returnFocusToOpener = useCallback(() => {
      const active = document.activeElement
      const inside = refs.floating.current?.contains(active) || active === checkboxRef.current
      if (active && active !== document.body && !inside) return
      document
        .querySelector<HTMLElement>(`label[for="${modalId}"][role="button"]`)
        ?.focus({ preventScroll: true })
    }, [modalId, refs])

    const handleCheckboxChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setIsOpen(event.target.checked)
        if (onModalStateChange) {
          onModalStateChange(event.target.checked)
        }
        if (!event.target.checked) returnFocusToOpener()
      },
      [onModalStateChange, returnFocusToOpener]
    )

    useImperativeHandle(ref, () => ({
      check: () => {
        if (checkboxRef.current) {
          checkboxRef.current.checked = true
          handleCheckboxChange({ target: { checked: true } } as React.ChangeEvent<HTMLInputElement>)
        }
      },
      uncheck: () => {
        if (checkboxRef.current) {
          checkboxRef.current.checked = false
          handleCheckboxChange({
            target: { checked: false }
          } as React.ChangeEvent<HTMLInputElement>)
        }
      }
    }))

    const modalControl = {
      close: () => {
        if (checkboxRef.current) {
          checkboxRef.current.checked = false
          handleCheckboxChange({
            target: { checked: false }
          } as React.ChangeEvent<HTMLInputElement>)
        }
      }
    }

    // Every close path (scrim label, in-drawer close, imperative uncheck()) funnels
    // through handleCheckboxChange, so isOpen reflects them all — see useHistoryDismiss.
    useHistoryDismiss(isOpen, modalControl.close)

    return (
      <div className={twMerge('drawer z-30 w-full', position === 'right' && 'drawer-end')}>
        <input
          id={modalId}
          type="checkbox"
          className="drawer-toggle"
          ref={checkboxRef}
          onChange={handleCheckboxChange}
        />
        {/* Guards set aria-hidden on the page, never inert: inert recreates media node views. */}
        <FloatingFocusManager
          context={context}
          disabled={!isOpen}
          initialFocus={refs.floating}
          returnFocus={false}>
          {/* daisyUI delays `visibility` by 0.1s on open, so focus would miss. Keyed to :checked,
              not React state, so a close that focuses the opener keeps the slide-out. */}
          <div
            ref={refs.setFloating}
            {...getFloatingProps()}
            aria-modal={isOpen || undefined}
            aria-label={ariaLabel}
            tabIndex={-1}
            className="drawer-side outline-none [.drawer-toggle:checked~&]:[transition-property:opacity]">
            <label htmlFor={modalId} aria-label="close sidebar" className="drawer-overlay"></label>
            <ModalContext.Provider value={modalControl}>{children}</ModalContext.Provider>
          </div>
        </FloatingFocusManager>
      </div>
    )
  }
)

ModalDrawer.displayName = 'ModalDrawer'
