import { clsx } from 'clsx'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import type { IconType } from 'react-icons'
import {
  LuEllipsisVertical,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuLock,
  LuLockOpen,
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

export function ActionsDropdown({
  doc,
  onTogglePrivate,
  onToggleReadOnly,
  onDelete,
  isUpdating
}: ActionsDropdownProps) {
  const menuId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openDocument = () => window.open(`${APP_URL}/${doc.docId}`, '_blank')
  const act = (fn: () => void) => () => {
    fn()
    setIsOpen(false)
  }

  // `dropdown-open` keeps the panel shown; daisyUI otherwise needs `:focus-within`, which Safari
  // does not give a clicked button.
  return (
    <div className={clsx('dropdown dropdown-end', isOpen && 'dropdown-open')} ref={dropdownRef}>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        aria-label="Document actions"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}>
        {isUpdating ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <LuEllipsisVertical className="h-4 w-4" aria-hidden />
        )}
      </button>
      {isOpen && (
        <ul
          id={menuId}
          className="dropdown-content bg-base-100 border-base-300 rounded-box z-50 m-0 mt-1 flex w-56 list-none flex-col border p-1.5 shadow-xl">
          <MenuRow icon={LuExternalLink} onClick={act(openDocument)}>
            Open in new tab
          </MenuRow>
          <MenuDivider />
          <MenuRow icon={doc.isPrivate ? LuLockOpen : LuLock} onClick={act(onTogglePrivate)}>
            {doc.isPrivate ? 'Make public' : 'Make private'}
          </MenuRow>
          <MenuRow icon={doc.readOnly ? LuEyeOff : LuEye} onClick={act(onToggleReadOnly)}>
            {doc.readOnly ? 'Remove read-only' : 'Make read-only'}
          </MenuRow>
          <MenuDivider />
          <MenuRow icon={LuTrash2} danger onClick={act(onDelete)}>
            Delete document
          </MenuRow>
        </ul>
      )}
    </div>
  )
}

interface MenuRowProps {
  icon: IconType
  onClick: () => void
  danger?: boolean
  children: ReactNode
}

/** Mirrors the webapp `ContextMenuRow`: `base-200` hover, `text-error` danger, dimmed idle icon. */
function MenuRow({ icon: Icon, onClick, danger = false, children }: MenuRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'rounded-field hover:bg-base-200 focus-visible:bg-base-200 focus-visible:ring-primary active:bg-base-300 flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset',
          danger && 'text-error'
        )}>
        <Icon className={clsx('h-4 w-4 shrink-0', !danger && 'opacity-70')} aria-hidden />
        {children}
      </button>
    </li>
  )
}

function MenuDivider() {
  return <li role="separator" aria-hidden className="bg-base-300 my-1 h-px shrink-0" />
}
