import { ChunkLoadFallback } from '@components/ChunkLoadFallback'
import { Avatar } from '@components/ui/Avatar'
import Button, { dangerGhostClassName } from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { ListGroupLabel } from '@components/ui/ListGroupLabel'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useAuthStore } from '@stores'
import { reportCurrentDocument } from '@utils/reportContent'
import { sheetSafeAreaPadMobileClassName } from '@utils/sheetBodyPadding'
import { twMerge } from '@utils/twMerge'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { type ComponentType, type CSSProperties, useCallback, useState } from 'react'
import type { IconType } from 'react-icons'
import { LuChevronLeft, LuChevronRight, LuExternalLink, LuLogOut } from 'react-icons/lu'

import { SETTINGS_TABS, supportRowsFor } from './constants'
import { useSignOut } from './hooks/useSignOut'
import { openSignOutConfirm } from './openSignOutConfirm'
import {
  AppearanceSkeleton,
  ConnectedAppsSkeleton,
  DocumentsSkeleton,
  NotificationsSkeleton,
  ProfileSkeleton,
  SecuritySkeleton
} from './SettingsPanelSkeleton'
import type { SettingsPanelProps, SupportInk, SupportRow, TabType } from './types'

const ProfileSection = dynamic(() => import('./components/ProfileSection'), {
  loading: (p) => <ChunkLoadFallback {...p} skeleton={<ProfileSkeleton />} />
})
const DocumentsSection = dynamic(() => import('./components/DocumentsSection'), {
  loading: (p) => <ChunkLoadFallback {...p} skeleton={<DocumentsSkeleton />} />
})
const AppearanceSection = dynamic(() => import('./components/AppearanceSection'), {
  loading: (p) => <ChunkLoadFallback {...p} skeleton={<AppearanceSkeleton />} />
})
const SecuritySection = dynamic(() => import('./components/SecuritySection'), {
  loading: (p) => <ChunkLoadFallback {...p} skeleton={<SecuritySkeleton />} />
})
const NotificationsSection = dynamic(() => import('./components/NotificationsSection'), {
  loading: (p) => <ChunkLoadFallback {...p} skeleton={<NotificationsSkeleton />} />
})
const ConnectedAppsSection = dynamic(() => import('./components/ConnectedAppsSection'), {
  loading: (p) => <ChunkLoadFallback {...p} skeleton={<ConnectedAppsSkeleton />} />
})

const STAR_SPARK_ANGLES = [0, 60, 120, 180, 240, 300] as const

const SUPPORT_ROW_CLASS =
  'text-base-content/70 hover:text-base-content hover:bg-base-200 focus-visible:ring-primary group rounded-field flex min-h-[44px] items-center gap-2.5 px-2 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none'

function supportInkClass(ink: SupportInk): string {
  switch (ink) {
    case 'accent':
      return 'group-hover:text-accent group-focus-visible:text-accent'
    case 'warning':
      return 'group-hover:text-warning group-focus-visible:text-warning'
    case 'error':
      return 'group-hover:text-error group-focus-visible:text-error'
    default: {
      const _exhaustive: never = ink
      return _exhaustive
    }
  }
}

const SupportStarIcon = ({ Icon }: { Icon: IconType }) => (
  <span className="relative inline-flex size-4 shrink-0 items-center justify-center overflow-visible">
    <Icon
      size={16}
      className="group-hover/star:fill-accent group-hover/star:text-accent group-focus-visible/star:fill-accent group-focus-visible/star:text-accent origin-center motion-safe:group-hover/star:animate-[star-pop_var(--motion-region)_var(--motion-ease-enter)_both] motion-safe:group-focus-visible/star:animate-[star-pop_var(--motion-region)_var(--motion-ease-enter)_both]"
    />
    {STAR_SPARK_ANGLES.map((angle) => (
      <span
        key={angle}
        aria-hidden
        style={{ '--star-spark-angle': `${angle}deg` } as CSSProperties}
        className="bg-accent pointer-events-none absolute top-1/2 left-1/2 -mt-0.5 -ml-0.5 size-1 rounded-full opacity-0 motion-safe:group-hover/star:animate-[star-spark_var(--motion-region)_var(--motion-ease-enter)_forwards] motion-safe:group-focus-visible/star:animate-[star-spark_var(--motion-region)_var(--motion-ease-enter)_forwards]"
      />
    ))}
  </span>
)

const SupportRowControl = ({ row }: { row: SupportRow }) => {
  const Icon = row.icon
  const inkClass = supportInkClass(row.ink)
  const isStarBurst = row.kind === 'link' && row.burst === 'star'
  const body = (
    <>
      {isStarBurst ? (
        <SupportStarIcon Icon={Icon} />
      ) : (
        <Icon size={16} className={twMerge('shrink-0 transition-colors', inkClass)} />
      )}
      {row.label}
      {row.kind === 'link' && (
        <LuExternalLink
          size={14}
          className={twMerge(
            'ml-auto shrink-0 opacity-40 transition-colors',
            inkClass,
            'group-hover:opacity-100 group-focus-visible:opacity-100'
          )}
        />
      )}
    </>
  )

  if (row.kind === 'link') {
    return (
      <a
        href={row.href}
        target="_blank"
        rel="noopener noreferrer"
        className={twMerge(SUPPORT_ROW_CLASS, isStarBurst && 'group/star overflow-visible')}>
        {body}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={reportCurrentDocument}
      className={twMerge(SUPPORT_ROW_CLASS, 'w-full')}>
      {body}
    </button>
  )
}

interface SectionProps {
  onOpenDocument?: () => void
  onSelectTab?: (tab: TabType) => void
}

// Sections read only the optional props they need.
const TAB_COMPONENTS: Record<TabType, ComponentType<SectionProps>> = {
  profile: ProfileSection,
  documents: DocumentsSection,
  appearance: AppearanceSection,
  security: SecuritySection,
  notifications: NotificationsSection,
  'connected-apps': ConnectedAppsSection
}

const SettingsPanel = ({ defaultTab, onClose }: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab ?? 'profile')
  // A deep link names a tab, so the phone must open its pane, not the tab list. The test is
  // whether a tab was NAMED: `profile` is also the fallback, so comparing against it cannot
  // tell `#settings?tab=profile` from a bare `#settings`. The pane keeps its back button.
  const [showContent, setShowContent] = useState(defaultTab !== undefined)
  const user = useAuthStore((state) => state.profile)
  const email = useAuthStore((s) => s.session?.email)
  const supportRows = supportRowsFor(useRouter().pathname)
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
  const activeTabConfig = SETTINGS_TABS.find((tab) => tab.id === activeTab)
  const activeLabel = activeTabConfig?.label

  return (
    <div className="bg-base-100 relative flex min-h-0 flex-1 flex-col overflow-clip md:h-[min(85vh,800px)] md:flex-none md:flex-row">
      <div
        className={`border-base-300 bg-base-100 flex min-h-0 w-full flex-1 flex-col motion-safe:animate-[doc-content-in_180ms_ease-out_both] max-md:absolute max-md:inset-0 md:w-72 md:flex-none md:shrink-0 md:border-r lg:w-80 ${
          showContent
            ? 'max-md:invisible max-md:[transform:translateX(-25%)] max-md:motion-safe:[transition:transform_var(--motion-panel)_var(--motion-ease-exit),visibility_0s_var(--motion-panel)]'
            : 'max-md:motion-safe:[transition:transform_var(--motion-panel)_var(--motion-ease-enter)]'
        }`}>
        {/* Phone rows are 44px targets, so the header drops to py-1.5 and keeps the pane header's height. */}
        <div className="border-base-300 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-1.5 md:hidden">
          <h2 className="text-base-content text-xl font-semibold">Settings</h2>
          <CloseButton
            onClick={handleClose}
            iconSize={20}
            className="min-h-11 min-w-11"
            aria-label="Close settings"
          />
        </div>

        <ScrollArea className="min-h-0 flex-1 overscroll-contain p-4 sm:p-6" scrollbarSize="thin">
          <div className="bg-base-200 rounded-box mb-4 flex items-center gap-2.5 p-2.5">
            <Avatar face={user} clickable={false} size="sm" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-base-content truncate text-sm font-semibold">
                {user?.display_name || user?.full_name || 'User'}
              </p>
              <p className="text-meta text-base-content/60 truncate">{email}</p>
            </div>
          </div>

          <nav aria-label="Settings" className="mb-4">
            {/* The phone hub header already reads "Settings", so this label is for screen readers there. */}
            <ListGroupLabel as="h3" className="mb-1.5 px-2 max-md:sr-only">
              Settings
            </ListGroupLabel>
            <ul className="menu menu-sm w-full gap-0.5 p-0">
              {SETTINGS_TABS.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <li key={item.id}>
                    <Button
                      onClick={() => handleTabChange(item.id)}
                      aria-current={isActive ? 'page' : undefined}
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

          <div className="mb-4">
            <ListGroupLabel as="h3" className="mb-1.5 px-2">
              Open source
            </ListGroupLabel>
            <ul className="space-y-0.5">
              {supportRows.map((row) => (
                <li key={row.label}>
                  <SupportRowControl row={row} />
                </li>
              ))}
            </ul>
          </div>
        </ScrollArea>

        <div
          className={twMerge(
            'border-base-300 mt-auto shrink-0 border-t p-4 sm:px-6',
            sheetSafeAreaPadMobileClassName
          )}>
          <Button
            onClick={() => openSignOutConfirm({ onConfirm: handleSignOut })}
            loading={signOutLoading}
            variant="ghost"
            shape="block"
            startIcon={LuLogOut}
            className={twMerge(dangerGhostClassName, 'font-medium')}>
            Sign out
          </Button>
        </div>
      </div>

      <div
        className={`bg-base-100 flex min-h-0 min-w-0 flex-1 flex-col max-md:absolute max-md:inset-0 ${
          showContent
            ? 'max-md:motion-safe:[transition:transform_var(--motion-panel)_var(--motion-ease-enter)]'
            : 'max-md:invisible max-md:[transform:translateX(100%)] max-md:motion-safe:[transition:transform_var(--motion-panel)_var(--motion-ease-exit),visibility_0s_var(--motion-panel)]'
        }`}>
        <div className="border-base-300 bg-base-100 flex shrink-0 items-center gap-2 border-b px-4 py-3 max-md:py-1.5">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="sm"
            shape="square"
            startIcon={LuChevronLeft}
            iconSize={20}
            aria-label="Back to menu"
            className="min-h-11 min-w-11 md:hidden"
          />
          <h2 className="text-base-content flex-1 text-xl font-semibold">{activeLabel}</h2>
          {/* CloseButton takes one glyph size, so each breakpoint gets its own: phone 20, desktop 16. */}
          <CloseButton
            onClick={handleClose}
            iconSize={20}
            className="min-h-11 min-w-11 md:hidden"
            aria-label="Close settings"
          />
          <CloseButton
            onClick={handleClose}
            className="max-md:hidden"
            aria-label="Close settings"
          />
        </div>

        <ScrollArea
          className={`bg-base-200 min-h-0 flex-1 overscroll-contain ${
            activeTabConfig?.fullWidth ? 'max-md:bg-base-100' : ''
          }`}
          scrollbarSize="thin">
          <div
            className={twMerge(
              'mx-auto p-4 sm:p-6',
              activeTabConfig?.fullWidth
                ? 'w-full max-w-none max-md:flex max-md:min-h-full max-md:flex-col max-md:p-0'
                : 'max-w-2xl',
              sheetSafeAreaPadMobileClassName
            )}>
            <ActiveSection onOpenDocument={handleClose} onSelectTab={handleTabChange} />
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export default SettingsPanel
