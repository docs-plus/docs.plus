/**
 * Sidebar Component
 * =================
 * Left sidebar navigation with search and anchor links.
 */

import { useCallback, useEffect, useRef } from 'react'
import { MdSearch, MdClose, MdChevronRight } from 'react-icons/md'
import { NAV_SECTIONS } from '../../constants'
import { useDesignSystemDocs } from '../../context/DesignSystemDocsContext'
import { ScrollArea } from '@components/ui'

export const Sidebar = () => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    activeSection,
    setActiveSection,
    sidebarOpen,
    setSidebarOpen
  } = useDesignSystemDocs()

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSearchQuery])

  const handleNavClick = useCallback(
    (id: string) => {
      setActiveSection(id)
      setSidebarOpen(false)
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [setActiveSection, setSidebarOpen]
  )

  const handleSearchResultClick = (id: string) => {
    setSearchQuery('')
    handleNavClick(id)
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Design System</h1>
            <p className="text-xs text-slate-500">docs.plus v1.1.0</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="btn btn-ghost btn-sm btn-circle lg:hidden">
            <MdClose size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative shrink-0 p-4">
          <div className="relative">
            <MdSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm focus:border-primary w-full border-slate-200 bg-slate-50 pr-16 pl-9 focus:bg-white"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline-flex">
              ⌘K
            </kbd>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="absolute top-full right-4 left-4 z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSearchResultClick(result.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50">
                  <MdChevronRight size={16} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{result.title}</p>
                    <p className="truncate text-xs text-slate-400">{result.section}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1" scrollbarSize="thin">
          <nav className="p-4 pt-0">
            {NAV_SECTIONS.map((section) => (
              <div key={section.id} className="mb-4">
                <p className="mb-2 px-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => handleNavClick(item.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                          activeSection === item.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                        }`}>
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 p-4">
          <a
            href="https://github.com/docs-plus/docs.plus"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary flex items-center gap-2 text-xs text-slate-500 transition-colors">
            <span>View on GitHub</span>
            <MdChevronRight size={14} />
          </a>
        </div>
      </aside>
    </>
  )
}
