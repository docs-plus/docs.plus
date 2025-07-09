import React, { useCallback, useImperativeHandle, forwardRef, useState, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { useModalBottomToTopOptional } from './ModalBottomToTopContext'

interface ModalBottomToTopProps {
  modalId?: string
  className?: string
  contentClassName?: string
  children: React.ReactNode
  onModalStateChange?: (isOpen: boolean) => void
  defaultHeight?: number
  showBackdrop?: boolean
}

export const ModalBottomToTop = forwardRef<unknown, ModalBottomToTopProps>(
  (
    {
      modalId = 'bottom_to_top_modal',
      className,
      children,
      onModalStateChange,
      contentClassName,
      defaultHeight = 300,
      showBackdrop = true
    },
    ref
  ) => {
    const checkboxRef = React.useRef<HTMLInputElement>(null)
    const contentRef = React.useRef<HTMLDivElement>(null)
    const [modalHeight, setModalHeight] = useState<number>(defaultHeight)
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [startY, setStartY] = useState<number>(0)
    const [startHeight, setStartHeight] = useState<number>(0)
    const [isTouched, setIsTouched] = useState<boolean>(false)

    // Use context if available, otherwise rely on checkbox state
    const modalContext = useModalBottomToTopOptional()

    const handleCheckboxChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = event.target.checked

        if (isChecked) {
          window.history.pushState({ modal: modalId }, '')
        } else {
          if (window.history.state?.modal === modalId) {
            window.history.back()
          }
        }

        // Update context if available
        if (modalContext) {
          if (isChecked) {
            modalContext.openModal()
          } else {
            modalContext.closeModal()
          }
        }

        if (onModalStateChange) {
          onModalStateChange(isChecked)
        }
      },
      [onModalStateChange, modalId, modalContext]
    )

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        setIsDragging(true)
        setStartY(e.touches[0].clientY)
        setStartHeight(modalHeight)
        setIsTouched(true)

        // Dispatch custom event to close emoji picker, if it is open
        document.dispatchEvent(new CustomEvent('closeEmojiPicker'))
      },
      [modalHeight]
    )

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (!isDragging) return
        // e.preventDefault()
        const deltaY = startY - e.touches[0].clientY
        const newHeight = Math.max(100, Math.min(window.innerHeight * 1, startHeight + deltaY))
        setModalHeight(newHeight)
      },
      [isDragging, startY, startHeight]
    )

    const handleTouchEnd = useCallback(() => {
      setIsDragging(false)
      setIsTouched(false)
    }, [])

    useEffect(() => {
      const handleTouchMoveGlobal = (e: TouchEvent) => {
        if (isDragging) {
          e.preventDefault()
        }
      }

      document.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false })
      return () => {
        document.removeEventListener('touchmove', handleTouchMoveGlobal)
      }
    }, [isDragging])

    // Sync context state with checkbox
    useEffect(() => {
      if (modalContext && checkboxRef.current) {
        checkboxRef.current.checked = modalContext.isOpen
      }
    }, [modalContext?.isOpen])

    useEffect(() => {
      const handlePopState = () => {
        if (checkboxRef.current?.checked) {
          checkboxRef.current.checked = false
          handleCheckboxChange({
            target: { checked: false }
          } as React.ChangeEvent<HTMLInputElement>)
        }
      }

      window.addEventListener('popstate', handlePopState)
      return () => window.removeEventListener('popstate', handlePopState)
    }, [handleCheckboxChange])

    useImperativeHandle(
      ref,
      () => ({
        check: () => {
          if (modalContext) {
            modalContext.openModal()
          } else if (checkboxRef.current) {
            checkboxRef.current.checked = true
            handleCheckboxChange({
              target: { checked: true }
            } as React.ChangeEvent<HTMLInputElement>)
          }
        },
        uncheck: () => {
          if (modalContext) {
            modalContext.closeModal()
          } else if (checkboxRef.current) {
            checkboxRef.current.checked = false
            handleCheckboxChange({
              target: { checked: false }
            } as React.ChangeEvent<HTMLInputElement>)
          }
        }
      }),
      [modalContext, handleCheckboxChange]
    )

    return (
      <div className={twMerge('bottom-to-top-modal', className)}>
        <input
          type="checkbox"
          id={modalId}
          ref={checkboxRef}
          className="peer modal-toggle hidden"
          onChange={handleCheckboxChange}
        />

        {showBackdrop ? (
          <div className="modal-overlay pointer-events-none absolute inset-0 z-50 flex h-full flex-col items-center justify-end opacity-0 transition-all duration-300 peer-checked:pointer-events-auto peer-checked:opacity-100">
            <label
              htmlFor={modalId}
              className="modal-backdrop absolute inset-0 h-full bg-[#0006]"
            />
            <div
              ref={contentRef}
              className={twMerge(
                'modal-content sticky bottom-0 w-full max-w-md translate-y-full rounded-t-2xl bg-white shadow-lg transition-transform duration-300 ease-in-out peer-checked:translate-y-0',
                contentClassName
              )}
              style={{ height: modalHeight ? `${modalHeight}px` : '300px', maxHeight: '100%' }}>
              <div
                className={twMerge(
                  'gripper group sticky top-0 z-10 mx-auto flex h-6 w-full cursor-row-resize items-center justify-center pt-1 transition-all',
                  isTouched ? 'scale-110' : ''
                )}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}>
                <div className="bg-neutral h-2 w-24 rounded-md group-hover:drop-shadow-md" />
              </div>
              {children}
            </div>
          </div>
        ) : (
          <div
            ref={contentRef}
            className={twMerge(
              'modal-content sticky right-0 bottom-0 left-0 z-50 w-full max-w-md translate-y-full rounded-t-2xl bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out peer-checked:translate-y-0',
              contentClassName
            )}
            style={{ height: modalHeight ? `${modalHeight}px` : '300px', maxHeight: '100%' }}>
            <div
              className={twMerge(
                'gripper group sticky top-0 z-10 mx-auto flex h-6 w-full cursor-row-resize items-center justify-center pt-1 transition-all',
                isTouched ? 'scale-110' : ''
              )}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}>
              <div className="bg-neutral h-2 w-24 rounded-md group-hover:drop-shadow-md" />
            </div>
            {children}
          </div>
        )}

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
)

ModalBottomToTop.displayName = 'ModalBottomToTop'
