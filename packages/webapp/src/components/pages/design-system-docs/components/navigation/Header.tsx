/**
 * Header Component
 * ================
 * Mobile header with menu toggle and theme switch.
 */

import { MdMenu, MdLightMode, MdDarkMode } from 'react-icons/md'
import { useDesignSystemDocs } from '../../context/DesignSystemDocsContext'
import { useState, useEffect } from 'react'

export const Header = () => {
  const { setSidebarOpen } = useDesignSystemDocs()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const theme = document.documentElement.getAttribute('data-theme')
    setIsDark(theme === 'docsplus-dark')
  }, [])

  const toggleTheme = () => {
    const newTheme = isDark ? 'docsplus' : 'docsplus-dark'
    document.documentElement.setAttribute('data-theme', newTheme)
    setIsDark(!isDark)
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm lg:hidden">
      <button
        onClick={() => setSidebarOpen(true)}
        className="btn btn-ghost btn-sm btn-circle"
        aria-label="Open menu">
        <MdMenu size={24} />
      </button>

      <h1 className="text-base font-bold text-slate-800">Design System</h1>

      <button
        onClick={toggleTheme}
        className="btn btn-ghost btn-sm btn-circle"
        aria-label="Toggle theme">
        {isDark ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
      </button>
    </header>
  )
}
