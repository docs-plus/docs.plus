/**
 * Header Component
 * =================
 * Top header with search, notifications, and user menu.
 */

import { Avatar, PanelHeader } from '@components/ui'
import {
  MdAccountCircle,
  MdChevronLeft,
  MdChevronRight,
  MdDarkMode,
  MdHome,
  MdLightMode,
  MdLogout,
  MdMenu,
  MdNotifications,
  MdSearch,
  MdSettings
} from 'react-icons/md'

import { useDesignSystem } from '../../context/DesignSystemContext'

export const Header = () => {
  const {
    theme,
    toggleTheme,
    activeTab,
    sidebarOpen,
    setSidebarOpen,
    setMobileMenuOpen,
    mobileMenuOpen,
    showNotifications,
    setShowNotifications
  } = useDesignSystem()

  return (
    <header
      className="border-base-300 bg-base-100 flex h-16 shrink-0 items-center justify-between border-b px-4"
      role="banner">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          className="btn btn-ghost btn-circle btn-sm lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}>
          <MdMenu size={24} aria-hidden="true" />
        </button>

        {/* Sidebar toggle (desktop) */}
        <button
          className="btn btn-ghost btn-circle btn-sm hidden transition-transform hover:scale-105 lg:flex"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          {sidebarOpen ? <MdChevronLeft size={20} /> : <MdChevronRight size={20} />}
        </button>

        {/* Breadcrumbs */}
        <nav className="breadcrumbs hidden text-sm sm:flex" aria-label="Breadcrumb">
          <ul>
            <li>
              <MdHome size={16} className="mr-1" aria-hidden="true" />
              <span>Home</span>
            </li>
            <li className="text-primary font-medium capitalize" aria-current="page">
              {activeTab}
            </li>
          </ul>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden sm:block">
          <div className="join">
            <label className="sr-only" htmlFor="header-search">
              Search
            </label>
            <input
              id="header-search"
              className="input input-bordered input-sm join-item w-48 transition-all focus:w-64"
              placeholder="Search... (⌘K)"
            />
            <button className="btn btn-sm btn-ghost join-item" aria-label="Search">
              <MdSearch size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="dropdown dropdown-end">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
            aria-haspopup="true"
            aria-expanded={showNotifications}>
            <div className="indicator">
              <MdNotifications size={20} aria-hidden="true" />
              <span
                className="indicator-item badge badge-primary badge-xs"
                aria-label="3 unread notifications"></span>
            </div>
          </div>
          {showNotifications && (
            <div
              tabIndex={0}
              className="dropdown-content border-base-300 bg-base-100 animate-in fade-in slide-in-from-top-2 z-50 mt-2 w-80 rounded-2xl border p-0 shadow-xl duration-200"
              role="menu">
              <PanelHeader
                icon={MdNotifications}
                title="Notifications"
                description="3 unread messages"
                variant="info"
                onClose={() => setShowNotifications(false)}
              />
              <div className="max-h-64 overflow-y-auto p-2">
                <ul className="menu gap-1 p-0" role="list">
                  <li>
                    <a className="flex-col items-start gap-0.5 transition-colors">
                      <span className="font-medium">New comment on "Q4 Roadmap"</span>
                      <span className="text-base-content/50 text-xs">2 minutes ago</span>
                    </a>
                  </li>
                  <li>
                    <a className="flex-col items-start gap-0.5 transition-colors">
                      <span className="font-medium">Sarah shared a document</span>
                      <span className="text-base-content/50 text-xs">1 hour ago</span>
                    </a>
                  </li>
                  <li>
                    <a className="flex-col items-start gap-0.5 transition-colors">
                      <span className="font-medium">Team meeting in 30 minutes</span>
                      <span className="text-base-content/50 text-xs">Today at 2:30 PM</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn btn-ghost btn-circle btn-sm transition-transform hover:scale-105 hover:rotate-12"
          aria-label={theme === 'docsplus' ? 'Switch to dark mode' : 'Switch to light mode'}>
          {theme === 'docsplus' ? <MdDarkMode size={20} /> : <MdLightMode size={20} />}
        </button>

        {/* User avatar */}
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" aria-label="User menu" aria-haspopup="true">
            <Avatar id="header-user" size="sm" clickable={false} />
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu border-base-300 bg-base-100 animate-in fade-in slide-in-from-top-2 z-50 mt-2 w-52 rounded-xl border p-2 shadow-lg duration-200"
            role="menu">
            <li role="none">
              <a role="menuitem">
                <MdAccountCircle size={18} aria-hidden="true" /> Profile
              </a>
            </li>
            <li role="none">
              <a role="menuitem">
                <MdSettings size={18} aria-hidden="true" /> Settings
              </a>
            </li>
            <li role="none">
              <a className="text-error" role="menuitem">
                <MdLogout size={18} aria-hidden="true" /> Sign out
              </a>
            </li>
          </ul>
        </div>
      </div>
    </header>
  )
}
