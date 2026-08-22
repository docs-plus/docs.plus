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
  width?: number // This will represent a percentage (e.g. 80 -> "80%")
  position?: 'left' | 'right' // new prop
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

export type ModalDrawerHandle = {
  check: () => void
  uncheck: () => void
}

export const ModalDrawer = forwardRef<ModalDrawerHandle, ModalDrawerProps>(
  (
    {
      modalId = 'left_to_right_modal',
      // className,
      children,
      onModalStateChange,
      // contentClassName,
      // width = 80, // default to 80%
      position = 'left' // default to left
    },
    ref
  ) => {
    const checkboxRef = React.useRef<HTMLInputElement>(null)
    const [isOpen, setIsOpen] = useState(false)

    const handleCheckboxChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setIsOpen(event.target.checked)
        if (onModalStateChange) {
          onModalStateChange(event.target.checked)
        }
      },
      [onModalStateChange]
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
        <div className="drawer-side">
          <label htmlFor={modalId} aria-label="close sidebar" className="drawer-overlay"></label>
          <ModalContext.Provider value={modalControl}>{children}</ModalContext.Provider>
        </div>
      </div>
    )
  }
)

ModalDrawer.displayName = 'ModalDrawer'
