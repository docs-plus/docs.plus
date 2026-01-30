import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useAuthStore } from '@stores'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import {
  LuBell,
  LuBug,
  LuChevronLeft,
  LuChevronRight,
  LuExternalLink,
  LuFileText,
  LuLightbulb,
  LuLogOut,
  LuShield,
  LuStar,
  LuUser} from 'react-icons/lu'

import { useSignOut } from './hooks/useSignOut'

// Dynamic imports for content panels
const ProfileContent = dynamic(() => import('./ProfileContent'), {
  loading: () => <ContentSkeleton />
})
const DocumentsContent = dynamic(() => import('./DocumentsContent'), {
  loading: () => <ContentSkeleton />
})
const SecurityContent = dynamic(() => import('./SecurityContent'), {
  loading: () => <ContentSkeleton />
})
const NotificationsContent = dynamic(() => import('./NotificationsContent'), {
  loading: () => <ContentSkeleton />
})

type TabType = 'profile' | 'documents' | 'security' | 'notifications'

interface ProfilePanelProps {
  /** Initial active tab */
  defaultTab?: TabType
  /** Callback when back pressed on mobile (to close modal) */
  onClose?: () => void
}

const ContentSkeleton = () => (
  <div className="space-y-4">
    <div className="bg-base-100 border-base-300 rounded-box border p-4 sm:p-6">
      <div className="skeleton mb-4 h-5 w-32 rounded" />
      <div className="flex items-center gap-4">
        <div className="skeleton size-20 shrink-0 rounded-2xl" />
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-20 rounded-lg" />
          <div className="skeleton h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
    <div className="bg-base-100 border-base-300 rounded-box border p-4 sm:p-6">
      <div className="skeleton mb-4 h-5 w-40 rounded" />
      <div className="space-y-3">
        <div className="skeleton h-11 w-full rounded-xl" />
        <div className="skeleton h-11 w-full rounded-xl" />
      </div>
    </div>
  </div>
)

const MENU_ITEMS: { id: TabType; label: string; icon: typeof LuUser }[] = [
  { id: 'profile', label: 'Profile', icon: LuUser },
  { id: 'documents', label: 'Documents', icon: LuFileText },
  { id: 'security', label: 'Security', icon: LuShield },
  { id: 'notifications', label: 'Notifications', icon: LuBell }
]

const GITHUB_REPO_URL = 'https://github.com/docs-plus/docs.plus'

const GITHUB_ACTIONS = [
  {
    href: GITHUB_REPO_URL,
    label: 'Star us on GitHub',
    description: 'Support the project',
    icon: LuStar,
    variant: 'accent' as const
  },
  {
    href: `${GITHUB_REPO_URL}/issues/new?template=feature_request.md`,
    label: 'Request a feature',
    description: 'Suggest an idea',
    icon: LuLightbulb,
    variant: 'info' as const
  },
  {
    href: `${GITHUB_REPO_URL}/issues/new?template=bug_report.md`,
    label: 'Report an issue',
    description: 'Found a bug?',
    icon: LuBug,
    variant: 'error' as const
  }
]

const ProfilePanel = ({ defaultTab = 'profile', onClose: _onClose }: ProfilePanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  const [showContent, setShowContent] = useState(false)
  const user = useAuthStore((state) => state.profile)
  const { isLoading: signOutLoading, handleSignOut } = useSignOut()

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setShowContent(true)
  }

  const handleBack = () => {
    setShowContent(false)
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileContent onBack={handleBack} />
      case 'documents':
        return <DocumentsContent onBack={handleBack} />
      case 'security':
        return <SecurityContent onBack={handleBack} />
      case 'notifications':
        return <NotificationsContent onBack={handleBack} />
      default:
        return null
    }
  }

  return (
    <div className="bg-base-100 flex h-[100dvh] flex-col md:h-[min(85vh,800px)] md:flex-row md:overflow-hidden">
      {/* Sidebar - full width on mobile, fixed width on desktop */}
      <aside
        className={`border-base-300 bg-base-100 flex w-full shrink-0 flex-col md:w-72 md:border-r lg:w-80 ${
          showContent ? 'hidden md:block md:flex' : 'flex'
        }`}>
        {/* Scrollable content area */}
        <ScrollArea className="flex-1 p-4 sm:p-6" scrollbarSize="thin">
          {/* User info header */}
          <div className="bg-base-200 mb-4 flex items-center gap-2.5 rounded-lg p-2.5">
            <Avatar
              id={user?.id}
              avatarUpdatedAt={user?.avatar_updated_at}
              src={user?.avatar_url}
              alt={user?.display_name || user?.full_name}
              size="sm"
              className="shrink-0 shadow-sm ring-2 ring-white"
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
            <p className="text-base-content/50 mb-1.5 px-2 text-[10px] font-semibold tracking-wider uppercase">
              Settings
            </p>
            <ul className="menu menu-sm w-full gap-0.5 p-0">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <li key={item.id}>
                    <Button
                      onClick={() => handleTabChange(item.id)}
                      variant={isActive ? 'primary' : 'ghost'}
                      className={`flex min-h-[40px] w-full items-center justify-between text-sm font-medium ${
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

          <div className="divider my-3" />

          {/* GitHub & Support section */}
          <nav className="mb-4">
            <p className="text-base-content/50 mb-2 px-2 text-[10px] font-semibold tracking-wider uppercase">
              Open Source
            </p>
            <div className="space-y-1.5">
              {GITHUB_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <a
                    key={action.label}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group bg-${action.variant}/10 hover:bg-${action.variant}/20 flex items-center gap-3 rounded-xl p-2.5 transition-all`}>
                    <div className="bg-base-100 flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
                      <Icon size={16} className={`text-${action.variant}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base-content text-sm font-medium">{action.label}</p>
                      <p className="text-base-content/60 text-xs">{action.description}</p>
                    </div>
                    <LuExternalLink
                      size={16}
                      className="text-base-content/40 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </a>
                )
              })}
            </div>

            {/* GitHub repo link */}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-base-300 bg-base-100 hover:bg-base-200 text-base-content mt-3 flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition-colors">
              <FaGithub size={18} />
              View on GitHub
            </a>
          </nav>
        </ScrollArea>

        {/* Sign out button - sticky at bottom */}
        <div className="border-base-300 shrink-0 border-t p-4 sm:px-6">
          <Button
            onClick={handleSignOut}
            disabled={signOutLoading}
            loading={signOutLoading}
            variant="neutral"
            size="sm"
            shape="block"
            startIcon={!signOutLoading ? LuLogOut : undefined}
            className="font-medium">
            Sign out
          </Button>
        </div>
      </aside>

      {/* Content area - hidden on mobile until selected */}
      <ScrollArea
        orientation="vertical"
        className={`bg-base-200 min-h-0 flex-1 ${showContent ? 'block' : 'hidden md:block'}`}>
        {/* Mobile header with back button */}
        <div className="border-base-300 bg-base-100 sticky top-0 z-10 flex items-center gap-2 border-b p-4 shadow-sm md:hidden">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="sm"
            shape="circle"
            startIcon={LuChevronLeft}
            iconSize={24}
            aria-label="Back to menu"
          />
          <span className="text-base-content text-base font-semibold">
            {MENU_ITEMS.find((item) => item.id === activeTab)?.label}
          </span>
        </div>

        {/* Content - constrained width for consistency */}
        <div className="mx-auto max-w-2xl p-4 sm:p-6">{renderContent()}</div>
      </ScrollArea>
    </div>
  )
}

export default ProfilePanel
