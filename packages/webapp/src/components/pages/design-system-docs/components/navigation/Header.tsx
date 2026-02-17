/**
 * Header Component
 * ================
 * Mobile header with menu toggle and theme switch.
 */

import { useThemeStore } from '@stores'
import { useCallback } from 'react'
import { MdDarkMode, MdLightMode, MdMenu } from 'react-icons/md'

import { useDesignSystemDocs } from '../../context/DesignSystemDocsContext'

export const Header = () => {
  const { setSidebarOpen } = useDesignSystemDocs()
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const setPreference = useThemeStore((s) => s.setPreference)

  const toggleTheme = useCallback(() => {
    setPreference(resolvedTheme === 'docsplus' ? 'dark' : 'light')
  }, [resolvedTheme, setPreference])

  return (
    <header className="border-base-300 bg-base-100/95 sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur-sm lg:hidden">
      <button
        onClick={() => setSidebarOpen(true)}
        className="btn btn-ghost btn-sm btn-circle"
        aria-label="Open menu">
        <MdMenu size={24} />
      </button>

      <h1 className="text-base-content text-base font-bold">Design System</h1>

      <button
        onClick={toggleTheme}
        className="btn btn-ghost btn-sm btn-circle"
        aria-label="Toggle theme">
        {resolvedTheme === 'docsplus-dark' ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
      </button>
    </header>
  )
}
