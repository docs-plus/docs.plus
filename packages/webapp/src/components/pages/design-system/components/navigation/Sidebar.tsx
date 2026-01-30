/**
 * Sidebar Component
 * ==================
 * Main navigation sidebar with collapsible sections.
 */

import { Avatar } from '@components/ui'
import { MdClose, MdHelpOutline, MdLogout,MdOpenInNew, MdStarOutline } from 'react-icons/md'

import { NAV_ITEMS } from '../../constants/demoData'
import { useDesignSystem } from '../../context/DesignSystemContext'

export const Sidebar = () => {
  const { activeTab, setActiveTab, sidebarOpen, mobileMenuOpen, setMobileMenuOpen } =
    useDesignSystem()

  return (
    <aside
      className={`border-base-300 bg-base-100 fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-all duration-300 ease-out lg:static lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      } ${!sidebarOpen && 'lg:w-20'}`}
      role="navigation"
      aria-label="Main navigation">
      {/* Sidebar Header */}
      <div className="border-base-300 flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-content flex size-10 items-center justify-center rounded-xl text-lg font-bold shadow-md transition-transform hover:scale-105">
            d+
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in hidden lg:block">
              <p className="text-sm font-bold">docs.plus</p>
              <p className="text-base-content/60 text-xs">Design System</p>
            </div>
          )}
        </div>
        <button
          className="btn btn-ghost btn-circle btn-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close sidebar">
          <MdClose size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Primary navigation">
        <ul className="menu gap-1 p-0" role="menubar">
          {NAV_ITEMS.map((item) => (
            <li key={item.id} role="none">
              <button
                role="menuitem"
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? 'page' : undefined}
                className={`flex items-center gap-3 transition-all duration-200 ${activeTab === item.id ? 'active' : 'hover:translate-x-0.5'}`}>
                <item.icon size={20} aria-hidden="true" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`badge badge-sm ${item.badge === 'New' ? 'badge-primary' : 'badge-ghost'}`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>

        {sidebarOpen && (
          <>
            <div className="divider text-base-content/40 my-3 text-xs">Quick Links</div>
            <ul className="menu gap-1 p-0" role="menu">
              <li role="none">
                <a
                  href="https://github.com/docs-plus/docs.plus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base-content/70 hover:text-primary transition-colors"
                  role="menuitem">
                  <MdStarOutline size={18} aria-hidden="true" />
                  Star on GitHub
                  <MdOpenInNew size={14} className="ml-auto opacity-50" aria-hidden="true" />
                </a>
              </li>
              <li role="none">
                <a
                  className="text-base-content/70 hover:text-primary transition-colors"
                  role="menuitem">
                  <MdHelpOutline size={18} aria-hidden="true" />
                  Documentation
                </a>
              </li>
            </ul>
          </>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-base-300 shrink-0 border-t p-3">
        {sidebarOpen ? (
          <div className="bg-base-200 hover:bg-base-300 flex items-center gap-3 rounded-xl p-2 transition-colors">
            <Avatar id="sidebar-user" size="sm" clickable={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">John Doe</p>
              <p className="text-base-content/50 truncate text-xs">john@docs.plus</p>
            </div>
            <button className="btn btn-ghost btn-circle btn-sm" aria-label="Sign out">
              <MdLogout size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <Avatar id="sidebar-user-mini" size="sm" clickable={false} />
          </div>
        )}
      </div>
    </aside>
  )
}
