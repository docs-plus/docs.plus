/**
 * ShowcaseLayout Component
 * ========================
 * Shared layout for all showcase pages with navigation and theme support.
 */

import { ReactNode, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  MdDarkMode,
  MdLightMode,
  MdMenu,
  MdClose,
  MdAccountCircle,
  MdTextFields,
  MdEdit,
  MdNotifications,
  MdDescription,
  MdHome,
  MdArrowBack
} from 'react-icons/md'

interface NavItem {
  href: string
  label: string
  icon: typeof MdAccountCircle
  description: string
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/showcase/profile',
    label: 'Profile',
    icon: MdAccountCircle,
    description: 'Account & settings'
  },
  {
    href: '/showcase/typography',
    label: 'Typography',
    icon: MdTextFields,
    description: 'Fonts & text styles'
  },
  {
    href: '/showcase/editor',
    label: 'Editor',
    icon: MdEdit,
    description: 'Document editing'
  },
  {
    href: '/showcase/notifications',
    label: 'Notifications',
    icon: MdNotifications,
    description: 'Alerts & bookmarks'
  },
  {
    href: '/showcase/documents',
    label: 'Documents',
    icon: MdDescription,
    description: 'Manage & create'
  }
]

interface ShowcaseLayoutProps {
  children: ReactNode
  title: string
  description?: string
}

export const ShowcaseLayout = ({ children, title, description }: ShowcaseLayoutProps) => {
  const router = useRouter()
  const [theme, setTheme] = useState<'docsplus' | 'docsplus-dark'>('docsplus')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'docsplus' ? 'docsplus-dark' : 'docsplus'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }, [theme])

  return (
    <div className="bg-base-100 min-h-screen" data-theme={theme}>
      {/* Header */}
      <header className="border-base-300 bg-base-100 sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Left - Logo & Back */}
          <div className="flex items-center gap-3">
            <Link
              href="/design-system"
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="Back to Design System">
              <MdArrowBack size={20} />
            </Link>
            <div className="hidden sm:block">
              <Link href="/" className="flex items-center gap-2">
                <div className="bg-primary text-primary-content flex size-8 items-center justify-center rounded-lg text-sm font-bold">
                  d+
                </div>
                <span className="text-base-content text-lg font-bold">docs.plus</span>
              </Link>
            </div>
          </div>

          {/* Center - Navigation (Desktop) */}
          <nav className="hidden lg:flex" aria-label="Main navigation">
            <ul className="menu menu-horizontal gap-1 p-0">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`gap-2 rounded-lg transition-colors ${
                      router.pathname === item.href ? 'active' : ''
                    }`}>
                    <item.icon size={18} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-circle btn-sm transition-transform hover:rotate-12"
              aria-label={theme === 'docsplus' ? 'Switch to dark mode' : 'Switch to light mode'}>
              {theme === 'docsplus' ? <MdDarkMode size={20} /> : <MdLightMode size={20} />}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className="btn btn-ghost btn-circle btn-sm lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}>
              {mobileMenuOpen ? <MdClose size={24} /> : <MdMenu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="border-base-300 bg-base-100 animate-in slide-in-from-top-2 border-t p-4 duration-200 lg:hidden">
            <ul className="menu gap-1 p-0">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg ${
                      router.pathname === item.href ? 'active' : ''
                    }`}>
                    <item.icon size={20} />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-base-content/60 text-xs">{item.description}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      {/* Page Header */}
      <div className="border-base-300 bg-base-200/50 border-b">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
          <nav className="breadcrumbs mb-4 text-sm" aria-label="Breadcrumb">
            <ul>
              <li>
                <Link href="/" className="text-base-content/60 hover:text-primary gap-1">
                  <MdHome size={14} />
                  Home
                </Link>
              </li>
              <li>
                <Link href="/design-system" className="text-base-content/60 hover:text-primary">
                  Showcase
                </Link>
              </li>
              <li className="text-primary font-medium">{title}</li>
            </ul>
          </nav>
          <h1 className="text-base-content text-3xl font-bold sm:text-4xl">{title}</h1>
          {description && <p className="text-base-content/60 mt-2 text-lg">{description}</p>}
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>

      {/* Footer */}
      <footer className="border-base-300 bg-base-200/30 border-t">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-base-content/60 text-sm">
              docs.plus Design System Showcase • Built with daisyUI & Tailwind CSS
            </p>
            <div className="flex gap-4">
              <Link
                href="/design-system"
                className="text-base-content/60 hover:text-primary text-sm">
                Components
              </Link>
              <a
                href="https://github.com/docs-plus/docs.plus"
                target="_blank"
                rel="noopener noreferrer"
                className="text-base-content/60 hover:text-primary text-sm">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
