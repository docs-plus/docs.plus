import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { ScrollArea } from '@components/ui/ScrollArea'
import config from '@config'
import { useAuthStore } from '@stores'
import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import {
  LuBell,
  LuBug,
  LuChevronLeft,
  LuChevronRight,
  LuExternalLink,
  LuFileText,
  LuGithub,
  LuLightbulb,
  LuLogOut,
  LuShield,
  LuStar,
  LuUser
} from 'react-icons/lu'

import { useSignOut } from './hooks/useSignOut'

// --- Constants ---

const SETTINGS_TABS: { id: TabType; label: string; icon: typeof LuUser }[] = [
  { id: 'profile', label: 'Profile', icon: LuUser },
  { id: 'documents', label: 'Documents', icon: LuFileText },
  { id: 'security', label: 'Security', icon: LuShield },
  { id: 'notifications', label: 'Notifications', icon: LuBell }
]

const { githubRepoUrl: GITHUB_REPO_URL } = config.links

const SUPPORT_LINKS = [
  {
    href: GITHUB_REPO_URL,
    label: 'Star us on GitHub',
    icon: LuStar
  },
  {
    href: `${GITHUB_REPO_URL}/issues/new?template=feature_request.md`,
    label: 'Request a Feature',
    icon: LuLightbulb
  },
  {
    href: `${GITHUB_REPO_URL}/issues/new?template=bug_report.md`,
    label: 'Report an Issue',
    icon: LuBug
  }
]

// --- Types ---

type TabType = 'profile' | 'documents' | 'security' | 'notifications'

interface SettingsPanelProps {
  /** Initial active tab */
  defaultTab?: TabType
  /** Callback to close the modal */
  onClose?: () => void
}

// --- Skeleton Loaders (tab-specific, inline — KISS) ---

const ProfileSkeleton = () => (
  <div className="space-y-4">
    <div className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-5">
        <div className="skeleton rounded-box size-24 shrink-0" />
        <div className="flex flex-col gap-2">
          <div className="skeleton rounded-field h-5 w-32" />
          <div className="skeleton rounded-field h-4 w-24" />
          <div className="skeleton rounded-field h-8 w-20" />
        </div>
      </div>
    </div>
    <div className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
      <div className="skeleton rounded-field mb-4 h-5 w-40" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="skeleton rounded-field h-11 w-full" />
        <div className="skeleton rounded-field h-11 w-full" />
      </div>
      <div className="skeleton rounded-field mt-4 h-24 w-full" />
    </div>
  </div>
)

const DocumentsSkeleton = () => (
  <div className="space-y-4">
    <div className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
      <div className="skeleton rounded-field h-11 w-full" />
    </div>
    <div className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton rounded-field size-5 shrink-0" />
            <div className="skeleton rounded-field h-4 flex-1" />
            <div className="skeleton rounded-field hidden h-4 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  </div>
)

const SecuritySkeleton = () => (
  <div className="space-y-4">
    <div className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
      <div className="skeleton rounded-field mb-4 h-5 w-32" />
      <div className="skeleton rounded-field mb-3 h-4 w-64" />
      <div className="skeleton rounded-field h-11 w-full" />
    </div>
  </div>
)

const NotificationsSkeleton = () => (
  <div className="space-y-4">
    <div className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
      <div className="skeleton rounded-field mb-4 h-5 w-40" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between py-3">
          <div className="flex-1 space-y-1">
            <div className="skeleton rounded-field h-4 w-24" />
            <div className="skeleton rounded-field h-3 w-40" />
          </div>
          <div className="skeleton h-6 w-10 rounded-full" />
        </div>
      ))}
    </div>
  </div>
)

// --- Dynamic Imports ---

const ProfileSection = dynamic(() => import('./components/ProfileSection'), {
  loading: () => <ProfileSkeleton />
})
const DocumentsSection = dynamic(() => import('./components/DocumentsSection'), {
  loading: () => <DocumentsSkeleton />
})
const SecuritySection = dynamic(() => import('./components/SecuritySection'), {
  loading: () => <SecuritySkeleton />
})
const NotificationsSection = dynamic(() => import('./components/NotificationsSection'), {
  loading: () => <NotificationsSkeleton />
})

// --- Component ---

const SettingsPanel = ({ defaultTab = 'profile', onClose }: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  const [showContent, setShowContent] = useState(false)
  const user = useAuthStore((state) => state.profile)
  const { isLoading: signOutLoading, handleSignOut } = useSignOut()

  // --- Navigation handlers ---

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    setShowContent(true)
  }, [])

  const handleBack = useCallback(() => {
    setShowContent(false)
  }, [])

  const handleClose = useCallback(() => {
    onClose?.()
  }, [onClose])

  // --- Render helpers ---

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSection />
      case 'documents':
        return <DocumentsSection />
      case 'security':
        return <SecuritySection />
      case 'notifications':
        return <NotificationsSection />
      default:
        return null
    }
  }

  return (
    <div className="bg-base-100 flex min-h-0 flex-1 flex-col overflow-hidden md:h-[min(85vh,800px)] md:flex-none md:flex-row">
      {/* Sidebar — full width on mobile, fixed width on desktop */}
      <aside
        className={`border-base-300 bg-base-100 flex w-full shrink-0 flex-col md:w-72 md:border-r lg:w-80 ${
          showContent ? 'hidden md:flex' : 'flex'
        }`}
        role="navigation"
        aria-label="Settings navigation">
        {/* Mobile sidebar header with close button */}
        <div className="border-base-300 flex items-center justify-between border-b p-4 md:hidden">
          <h2 className="text-base-content text-base font-semibold">Settings</h2>
          <CloseButton onClick={handleClose} aria-label="Close settings" />
        </div>

        {/* Scrollable content area */}
        <ScrollArea className="flex-1 p-4 sm:p-6" scrollbarSize="thin">
          {/* User info header */}
          <div className="bg-base-200 rounded-box mb-4 flex items-center gap-2.5 p-2.5">
            <Avatar
              id={user?.id}
              avatarUpdatedAt={user?.avatar_updated_at}
              src={user?.avatar_url}
              alt={user?.display_name || user?.full_name}
              size="sm"
              className="ring-base-100 shrink-0 shadow-sm ring-2"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base-content truncate text-sm font-semibold">
                {user?.display_name || user?.full_name || 'User'}
              </p>
              <p className="text-base-content/60 truncate text-xs">{user?.email}</p>
            </div>
          </div>

          {/* Main navigation menu */}
          <nav className="mb-4">
            <h3 className="text-base-content/50 mb-1.5 px-2 text-xs font-semibold tracking-wider uppercase">
              Settings
            </h3>
            <ul className="menu menu-sm w-full gap-0.5 p-0">
              {SETTINGS_TABS.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <li key={item.id}>
                    <Button
                      onClick={() => handleTabChange(item.id)}
                      variant={isActive ? 'primary' : 'ghost'}
                      className={`flex min-h-[44px] w-full items-center justify-between text-sm font-medium ${
                        !isActive ? 'text-base-content hover:bg-base-200' : ''
                      }`}>
                      <span className="flex items-center gap-2.5">
                        <Icon size={18} />
                        {item.label}
                      </span>
                      <LuChevronRight
                        size={18}
                        className={`md:hidden ${isActive ? 'text-primary-content/70' : 'text-base-content/50'}`}
                      />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="border-base-300 my-3 border-t" />

          {/* Support links — compact text rows */}
          <nav className="mb-4">
            <h3 className="text-base-content/50 mb-1.5 px-2 text-xs font-semibold tracking-wider uppercase">
              Open Source
            </h3>
            <ul className="space-y-0.5">
              {SUPPORT_LINKS.map((action) => {
                const Icon = action.icon
                return (
                  <li key={action.label}>
                    <a
                      href={action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base-content/70 hover:text-base-content hover:bg-base-200 rounded-field flex min-h-[44px] items-center gap-2.5 px-2 py-1.5 text-sm transition-colors">
                      <Icon size={16} className="shrink-0" />
                      {action.label}
                      <LuExternalLink size={14} className="ml-auto shrink-0 opacity-40" />
                    </a>
                  </li>
                )
              })}
            </ul>

            {/* GitHub repo link */}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-base-300 bg-base-100 hover:bg-base-200 text-base-content rounded-field mt-2 flex min-h-[44px] items-center justify-center gap-2 border p-2.5 text-sm font-medium transition-colors">
              <LuGithub size={18} />
              View on GitHub
            </a>
          </nav>
        </ScrollArea>

        {/* Sign out button — sticky at bottom */}
        <div className="border-base-300 mt-auto shrink-0 border-t p-4 sm:px-6">
          <Button
            onClick={handleSignOut}
            disabled={signOutLoading}
            loading={signOutLoading}
            variant="neutral"
            shape="block"
            startIcon={!signOutLoading ? LuLogOut : undefined}
            className="font-medium">
            Sign out
          </Button>
        </div>
      </aside>

      {/* Content area — hidden on mobile until a tab is selected */}
      <div className={`flex min-h-0 flex-1 flex-col ${showContent ? 'flex' : 'hidden md:flex'}`}>
        {/* Content header — mobile: back + title, desktop: title + close */}
        <div className="border-base-300 bg-base-100 flex shrink-0 items-center gap-2 border-b px-4 py-3">
          {/* Mobile back button */}
          <Button
            onClick={handleBack}
            variant="ghost"
            size="sm"
            shape="circle"
            startIcon={LuChevronLeft}
            iconSize={20}
            aria-label="Back to menu"
            className="md:hidden"
          />
          <h2 className="text-base-content flex-1 text-base font-semibold">
            {SETTINGS_TABS.find((item) => item.id === activeTab)?.label}
          </h2>
          {/* Desktop close button */}
          <CloseButton
            onClick={handleClose}
            aria-label="Close settings"
            className="hidden md:flex"
          />
        </div>

        {/* Scrollable content */}
        <ScrollArea orientation="vertical" className="bg-base-200 flex-1">
          <div className="mx-auto max-w-2xl p-4 sm:p-6">{renderContent()}</div>
        </ScrollArea>
      </div>
    </div>
  )
}

export default SettingsPanel
