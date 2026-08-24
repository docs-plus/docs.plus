import { ReactNode, useEffect, useState } from 'react'
import { LuMenu } from 'react-icons/lu'

import { useUIStore } from '@/stores/uiStore'

import { MobileMenu } from './MobileMenu'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

interface AdminLayoutProps {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const theme = useUIStore((state) => state.theme)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="bg-base-100 flex min-h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-base-300 bg-base-100 flex items-center justify-between border-b p-4 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Open menu">
            <LuMenu className="h-5 w-5" />
          </button>
          <span className="font-bold">docs.plus Admin</span>
          <ThemeToggle />
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
