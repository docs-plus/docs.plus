/**
 * DashboardLayout Component
 * ==========================
 * Main layout wrapper with sidebar, header, and content area.
 */

import { ReactNode } from 'react'
import { useDesignSystem } from '../context/DesignSystemContext'
import { Sidebar, Header, ChatPanel } from '../components'

interface DashboardLayoutProps {
  children: ReactNode
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { theme, mobileMenuOpen, setMobileMenuOpen, isTransitioning, activeTab } = useDesignSystem()

  return (
    <div
      data-theme={theme}
      className="bg-base-200 text-base-content flex h-screen overflow-hidden transition-colors duration-300">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          role="button"
          aria-label="Close menu"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <Header />

        {/* Page Content with Transitions */}
        <main
          className={`flex-1 overflow-y-auto p-4 transition-all duration-200 sm:p-6 ${isTransitioning ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}
          role="main"
          aria-label={`${activeTab} content`}>
          {children}
        </main>
      </div>

      {/* Chat Panel (Floating) */}
      <ChatPanel />
    </div>
  )
}
