import React, {
  useCallback,
  useImperativeHandle,
  forwardRef,
  createContext,
  useContext
} from 'react'
import { twMerge } from 'tailwind-merge'

interface ModalLeftToRightProps {
  modalId?: string
  className?: string
  contentClassName?: string
  children: React.ReactNode
  onModalStateChange?: (isOpen: boolean) => void
  width?: number // This will represent a percentage (e.g. 80 -> "80%")
}

interface ModalContextType {
  close: () => void
}

export const ModalContext = createContext<ModalContextType | null>(null)
export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModal must be used within a ModalLeftToRight')
  return context
}

export const ModalLeftToRight = forwardRef<unknown, ModalLeftToRightProps>(
  (
    {
      modalId = 'left_to_right_modal',
      className,
      children,
      onModalStateChange,
      contentClassName,
      width = 80 // default to 80%
    },
    ref
  ) => {
    const checkboxRef = React.useRef<HTMLInputElement>(null)

    const handleCheckboxChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
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

    return (
      <div className="drawer z-30 w-full">
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

ModalLeftToRight.displayName = 'ModalLeftToRight'
