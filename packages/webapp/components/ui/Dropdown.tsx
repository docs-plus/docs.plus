import React, { useState, useEffect, useRef } from 'react'

type DropdownProps = {
  label?: string
  button?: React.ReactNode
  children: React.ReactNode
}

const Dropdown = ({ label, button, children }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const toggleDropdown = () => setIsOpen(!isOpen)
  const closeDropdown = () => setIsOpen(false)

  // Close dropdown on ESC key press
  useEffect(() => {
    const handleEsc = (event: any) => {
      if (event.key === 'Escape') {
        closeDropdown()
      }
    }

    window.addEventListener('keydown', handleEsc)

    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="dropdown dropdown-end" ref={dropdownRef}>
      <div
        tabIndex={0}
        role="button"
        className={`${!button ? 'btn btn-sm' : ''}`}
        onClick={toggleDropdown}>
        {button ? button : label}
      </div>

      {isOpen && (
        <div
          tabIndex={0}
          className="dropdown-content z-[1] w-auto rounded-box bg-base-100 p-2 shadow">
          {children}
        </div>
      )}
    </div>
  )
}

export default Dropdown
