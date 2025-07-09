import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ModalBottomToTopContextValue {
  isOpen: boolean
  openModal: () => void
  closeModal: () => void
  toggleModal: () => void
}

const ModalBottomToTopContext = createContext<ModalBottomToTopContextValue | null>(null)

interface ModalBottomToTopProviderProps {
  children: ReactNode
  onModalStateChange?: (isOpen: boolean) => void
}

export const ModalBottomToTopProvider = ({
  children,
  onModalStateChange
}: ModalBottomToTopProviderProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const openModal = useCallback(() => {
    setIsOpen(true)
    onModalStateChange?.(true)
  }, [onModalStateChange])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    onModalStateChange?.(false)
  }, [onModalStateChange])

  const toggleModal = useCallback(() => {
    setIsOpen((prev) => {
      const newState = !prev
      onModalStateChange?.(newState)
      return newState
    })
  }, [onModalStateChange])

  return (
    <ModalBottomToTopContext.Provider
      value={{
        isOpen,
        openModal,
        closeModal,
        toggleModal
      }}>
      {children}
    </ModalBottomToTopContext.Provider>
  )
}

export const useModalBottomToTop = () => {
  const context = useContext(ModalBottomToTopContext)
  if (!context) {
    throw new Error('useModalBottomToTop must be used within a ModalBottomToTopProvider')
  }
  return context
}

// Optional hook that doesn't throw if no provider exists
export const useModalBottomToTopOptional = () => {
  return useContext(ModalBottomToTopContext)
}
