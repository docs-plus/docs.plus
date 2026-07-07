import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useAuthStore } from '@stores'
import dynamic from 'next/dynamic'
import { type ComponentType, useCallback, useState } from 'react'
import { LuChevronLeft, LuChevronRight, LuExternalLink, LuGithub, LuLogOut } from 'react-icons/lu'

import { GITHUB_REPO_URL, SETTINGS_TABS, SUPPORT_LINKS } from './constants'
import { useSignOut } from './hooks/useSignOut'
import {
  AppearanceSkeleton,
  DocumentsSkeleton,
  NotificationsSkeleton,
  ProfileSkeleton,
  SecuritySkeleton
} from './SettingsPanelSkeleton'
import type { SettingsPanelProps, TabType } from './types'

const ProfileSection = dynamic(() => import('./components/ProfileSection'), {
  loading: () => <ProfileSkeleton />
})
const DocumentsSection = dynamic(() => import('./components/DocumentsSection'), {
  loading: () => <DocumentsSkeleton />
})
const AppearanceSection = dynamic(() => import('./components/AppearanceSection'), {
  loading: () => <AppearanceSkeleton />
})
const SecuritySection = dynamic(() => import('./components/SecuritySection'), {
  loading: () => <SecuritySkeleton />
})
const NotificationsSection = dynamic(() => import('./components/NotificationsSection'), {
  loading: () => <NotificationsSkeleton />
})

const TAB_COMPONENTS: Record<TabType, ComponentType> = {
  profile: ProfileSection,
  documents: DocumentsSection,
  appearance: AppearanceSection,
  security: SecuritySection,
  notifications: NotificationsSection
}

const SettingsPanel = ({ defaultTab = 'profile', onClose }: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab)
  const [showContent, setShowContent] = useState(false)
  const user = useAuthStore((state) => state.profile)
  const { isLoading: signOutLoading, handleSignOut } = useSignOut()

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

  const ActiveSection = TAB_COMPONENTS[activeTab]
  const activeLabel = SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label

  return (
    <div className="bg-base-100 flex min-h-0 flex-1 flex-col overflow-hidden md:h-[min(85vh,800px)] md:flex-none md:flex-row">
      <aside
        className={`border-base-300 bg-base-100 flex min-h-0 w-full flex-1 flex-col motion-safe:animate-[doc-content-in_180ms_ease-out_both] md:w-72 md:flex-none md:shrink-0 md:border-r lg:w-80 ${
          showContent ? 'hidden md:flex' : 'flex'
        }`}
        role="navigation"
        aria-label="Settings navigation">
        <div className="border-base-300 flex items-center justify-between border-b p-4 md:hidden">
          <h2 className="text-base-content text-base font-semibold">Settings</h2>
          <CloseButton onClick={handleClose} aria-label="Close settings" />
        </div>

        <ScrollArea className="min-h-0 flex-1 p-4 sm:p-6" scrollbarSize="thin">
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

        <div className="border-base-300 mt-auto shrink-0 border-t p-4 sm:px-6">
          <Button
            onClick={handleSignOut}
            disabled={signOutLoading}
            loading={signOutLoading}
            variant="ghost"
            shape="block"
            startIcon={!signOutLoading ? LuLogOut : undefined}
            className="border-base-300 text-base-content/70 hover:bg-error/10 hover:text-error border font-medium">
            Sign out
          </Button>
        </div>
      </aside>

      <div className={`flex min-h-0 flex-1 flex-col ${showContent ? 'flex' : 'hidden md:flex'}`}>
        <div className="border-base-300 bg-base-100 flex shrink-0 items-center gap-2 border-b px-4 py-3">
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
          <h2 className="text-base-content flex-1 text-base font-semibold">{activeLabel}</h2>
          <CloseButton
            onClick={handleClose}
            aria-label="Close settings"
            className="hidden md:flex"
          />
        </div>

        <ScrollArea className="bg-base-200 min-h-0 flex-1" scrollbarSize="thin">
          <div className="mx-auto max-w-2xl p-4 sm:p-6">
            <ActiveSection />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export default SettingsPanel
