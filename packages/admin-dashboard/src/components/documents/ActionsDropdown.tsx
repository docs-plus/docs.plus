import { useState, useRef, useEffect } from 'react'
import {
  LuLock,
  LuLockOpen,
  LuEye,
  LuEyeOff,
  LuExternalLink,
  LuEllipsisVertical,
  LuTrash2
} from 'react-icons/lu'
import { APP_URL } from '@/constants/config'
import type { Document } from '@/types'

interface ActionsDropdownProps {
  doc: Document
  onTogglePrivate: () => void
  onToggleReadOnly: () => void
  onDelete: () => void
  isUpdating: boolean
}

/**
 * Actions dropdown for document table rows
 * Provides: Open in new tab, Toggle visibility, Toggle read-only, Delete
 */
export function ActionsDropdown({
  doc,
  onTogglePrivate,
  onToggleReadOnly,
  onDelete,
  isUpdating
}: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpenDocument = () => {
    window.open(`${APP_URL}/${doc.docId}`, '_blank')
    setIsOpen(false)
  }

  return (
    <div className="dropdown dropdown-end" ref={dropdownRef}>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}>
        {isUpdating ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <LuEllipsisVertical className="h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <ul className="dropdown-content menu bg-base-100 rounded-box border-base-300 z-50 w-56 border p-2 shadow-lg">
          <li>
            <button type="button" onClick={handleOpenDocument} className="gap-3">
              <LuExternalLink className="h-4 w-4" />
              Open in new tab
            </button>
          </li>
          <div className="divider my-1" />
          <li>
            <button
              type="button"
              onClick={() => {
                onTogglePrivate()
                setIsOpen(false)
              }}
              className="gap-3">
              {doc.isPrivate ? (
                <>
                  <LuLockOpen className="h-4 w-4" />
                  Make Public
                </>
              ) : (
                <>
                  <LuLock className="h-4 w-4" />
                  Make Private
                </>
              )}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onToggleReadOnly()
                setIsOpen(false)
              }}
              className="gap-3">
              {doc.readOnly ? (
                <>
                  <LuEyeOff className="h-4 w-4" />
                  Remove Read-only
                </>
              ) : (
                <>
                  <LuEye className="h-4 w-4" />
                  Make Read-only
                </>
              )}
            </button>
          </li>
          <div className="divider my-1" />
          <li>
            <button
              type="button"
              onClick={() => {
                onDelete()
                setIsOpen(false)
              }}
              className="text-error hover:bg-error hover:text-error-content gap-3">
              <LuTrash2 className="h-4 w-4" />
              Delete document
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
