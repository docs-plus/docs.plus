import React, { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

interface ModalBottomToTopProps {
  modalId?: string
  className?: string
  children: React.ReactNode
  onModalStateChange?: (isOpen: boolean) => void
}

export const ModalBottomToTop: React.FC<ModalBottomToTopProps> = ({
  modalId = 'bottom_to_top_modal',
  className,
  children,
  onModalStateChange
}) => {
  const handleCheckboxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onModalStateChange) {
        onModalStateChange(event.target.checked)
      }
    },
    [onModalStateChange]
  )
  return (
    <div className={twMerge('bottom-to-top-modal', className)}>
      <input
        type="checkbox"
        id={modalId}
        className="peer modal-toggle hidden"
        onChange={handleCheckboxChange}
      />

      <div className="modal-overlay pointer-events-none absolute inset-0 z-50 flex h-full items-end justify-center opacity-0 transition-all duration-300 peer-checked:pointer-events-auto peer-checked:opacity-100">
        <label
          htmlFor={modalId}
          className="modal-backdrop absolute inset-0 h-full bg-[#0006]"></label>

        <div className="modal-content sticky bottom-0 max-h-[90vh] w-full max-w-md translate-y-full overflow-y-auto rounded-t-lg bg-white shadow-lg transition-transform duration-300 ease-in-out peer-checked:translate-y-0">
          {children}
        </div>
      </div>

      <style>{`
        #${modalId}:checked ~ .modal-overlay {
          opacity: 1;
          pointer-events: auto;
        }

        #${modalId}:checked ~ .modal-overlay > .modal-content {
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}
