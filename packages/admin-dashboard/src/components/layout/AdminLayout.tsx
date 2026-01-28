import { ReactNode, useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { MobileMenu } from './MobileMenu'
import { useUIStore } from '@/stores/uiStore'
import { LuMenu } from 'react-icons/lu'
import { ThemeToggle } from './ThemeToggle'

interface AdminLayoutProps {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { theme } = useUIStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="bg-base-100 flex min-h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header */}
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

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
