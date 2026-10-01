import { LuX } from 'react-icons/lu'

import { NavBrand, NavFooter, NavLinks } from './NavRow'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[var(--modal-scrim)] lg:hidden" onClick={onClose} />

      <aside className="bg-base-200 fixed inset-y-0 left-0 z-50 flex w-64 flex-col lg:hidden">
        <div className="border-base-300 flex items-center justify-between border-b p-4">
          <NavBrand onNavigate={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Close menu">
            <LuX className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <NavLinks onNavigate={onClose} />

        <NavFooter />
      </aside>
    </>
  )
}
