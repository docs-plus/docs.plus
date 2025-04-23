import React, { useRef, useState, createContext, useContext, useEffect } from 'react'

interface DropdownContextType {
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  close: () => void
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined)

export const useDropdown = () => {
  const context = useContext(DropdownContext)
  if (context === undefined) {
    throw new Error('useDropdown must be used within a Dropdown component')
  }
  return context
}

interface DropdownProps {
  label?: string
  button?: React.ReactNode
  children: React.ReactNode
  className?: string
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  contentClassName?: string
}

const Dropdown: React.FC<DropdownProps> = ({
  label,
  button,
  children,
  className = '',
  defaultOpen = false,
  onOpenChange,
  contentClassName = 'dropdown-content bg-base-100 rounded-box z-[1] px-1 py-3 border border-gray-300 shadow-md'
}) => {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Update details.open when isOpen changes
  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = isOpen
    }
  }, [isOpen])

  // Handle toggle via summary click
  const handleToggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
    onOpenChange?.(newState)
  }

  // Manually handle the toggle event to ensure it works
  const handleDetailsToggle = (e: React.SyntheticEvent) => {
    // This handles the native details toggle event
    const details = e.currentTarget as HTMLDetailsElement
    setIsOpen(details.open)
    onOpenChange?.(details.open)
  }

  const closeDropdown = () => {
    setIsOpen(false)
    onOpenChange?.(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        closeDropdown()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <details
      className={`dropdown ${className}`}
      ref={detailsRef}
      open={isOpen}
      onToggle={handleDetailsToggle}>
      <summary
        className="cursor-pointer list-none outline-none"
        onClick={(e) => {
          // Prevent the default toggle behavior
          e.preventDefault()
          handleToggle()
        }}>
        {button || label || 'open or close'}
      </summary>
      <div className={`dropdown-content ${contentClassName}`}>
        <DropdownContext.Provider
          value={{
            isOpen,
            setIsOpen,
            close: closeDropdown
          }}>
          {children}
        </DropdownContext.Provider>
      </div>
    </details>
  )
}

export default Dropdown
