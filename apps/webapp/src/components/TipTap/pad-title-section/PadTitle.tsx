import SignInForm from '@components/auth/SignInForm'
import { useSettingsModal } from '@components/settings/hooks/useSettingsModal'
import SettingsPanelSkeleton from '@components/settings/SettingsPanelSkeleton'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { Modal, ModalContent } from '@components/ui/Dialog'
import {
  Popover,
  PopoverContent,
  popoverPanelClassName,
  PopoverTrigger
} from '@components/ui/Popover'
import UnreadBadge from '@components/ui/UnreadBadge'
import { useNotificationCount } from '@hooks/useNotificationCount'
import { DocsPlusIcon } from '@icons'
import { Icons } from '@icons'
import { useStore } from '@stores'
import { useAuthStore } from '@stores'
import { useThemeStore } from '@stores'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import React, { useState } from 'react'

import { NotificationPanelSkeleton } from '../../notificationPanel/components/NotificationPanelSkeleton'

const SettingsPanel = dynamic(() => import('@components/settings/SettingsPanel'), {
  loading: () => <SettingsPanelSkeleton />
})
import DocTitle from '../DocTitle'
import FilterBar from './FilterBar'
import PresentUsers from './PresentUsers'
import PrivateIndicator from './PrivateIndicator'
import ProviderSyncStatus from './ProviderSyncStatus'
import ReadOnlyIndicator from './ReadOnlyIndicator'
import ShareModal from './ShareModal'

const NotificationPanel = dynamic(
  () =>
    import('../../notificationPanel/desktop/NotificationPanel').then(
      (mod) => mod.NotificationPanel
    ),
  { loading: () => <NotificationPanelSkeleton /> }
)

const PadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const themePreference = useThemeStore((state) => state.preference)
  const setThemePreference = useThemeStore((state) => state.setPreference)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const { isOpen: isProfileModalOpen, setIsOpen: setProfileModalOpen } = useSettingsModal(!!user)
  const [isShareModalOpen, setShareModalOpen] = useState(false)
  const workspaceId = useStore((state) => state.settings.workspaceId)

  const unreadCount = useNotificationCount({ workspaceId })

  return (
    <>
      {/* Header bar; `border-b` is the sole line under the title row (toolbar uses `border-b` only, no `border-t` — see EditorToolbar). */}
      <header className="border-base-300 bg-base-100 relative z-30 flex min-h-12 w-full items-center border-b px-3 py-2 motion-safe:animate-[doc-region-in_220ms_ease-out_both]">
        {/* Left section: Logo + Document info */}
        <div className="flex flex-1 items-center gap-2">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <DocsPlusIcon size={34} />
          </Link>

          {/* Document title + sync status */}
          <div className="flex min-w-0 items-center gap-2">
            <DocTitle />
            <ProviderSyncStatus />
            <FilterBar displayRestButton={true} />
          </div>

          <PrivateIndicator />
          <ReadOnlyIndicator />
        </div>

        {/* Right section: Actions */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Present users */}
          {isAuthServiceAvailable && <PresentUsers />}

          {/* Share button */}
          <Button
            variant="primary"
            btnStyle={user ? 'outline' : undefined}
            startIcon={Icons.share}
            onClick={() => setShareModalOpen(true)}>
            Share
          </Button>

          {/* History is read-only for everyone. The server refuses `history.revert`
              for a visitor (hocuspocus.server.ts), so reading a version is safe. */}
          {
            <Button
              variant="ghost"
              shape="circle"
              onClick={() => (window.location.hash = 'history')}
              tooltip="History"
              tooltipPlacement="bottom">
              <Icons.history size={20} className="text-base-content/70" />
            </Button>
          }

          {/* Notifications - authenticated users only */}
          {isAuthServiceAvailable && user && (
            <Popover placement="bottom-end">
              <PopoverTrigger asChild>
                <Button variant="ghost" shape="circle" className="relative">
                  <Icons.notifications size={18} className="text-base-content/70" />
                  <UnreadBadge
                    count={unreadCount}
                    size="sm"
                    variant="error"
                    className="absolute -top-1 -right-2"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className={popoverPanelClassName}>
                <NotificationPanel />
              </PopoverContent>
            </Popover>
          )}

          {/* Profile / Sign in */}
          {isAuthServiceAvailable && (
            <>
              {user ? (
                <Button
                  variant="ghost"
                  shape="circle"
                  size="lg"
                  className="border-0 p-0"
                  onClick={() => setProfileModalOpen(true)}
                  tooltip="Profile"
                  tooltipPlacement="bottom">
                  <Avatar face={user} clickable={false} size="lg" className="pointer-events-none" />
                </Button>
              ) : (
                <>
                  {/* A signed-out reader cannot open Settings, so the theme
                      choice would be unreachable. Cycles light, dark, system. */}
                  <Button
                    variant="ghost"
                    shape="circle"
                    onClick={() => {
                      const order = ['light', 'dark', 'system'] as const
                      const next =
                        order[(order.indexOf(themePreference as never) + 1) % order.length]
                      setThemePreference(next)
                    }}
                    tooltip={`Theme: ${themePreference}`}
                    tooltipPlacement="bottom"
                    aria-label={`Theme: ${themePreference}. Click to change.`}>
                    {themePreference === 'dark' ? (
                      <Icons.moon size={20} />
                    ) : themePreference === 'system' ? (
                      <Icons.monitor size={20} />
                    ) : (
                      <Icons.sun size={20} />
                    )}
                  </Button>
                  <Button variant="neutral" onClick={() => setProfileModalOpen(true)}>
                    Sign in
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </header>

      {/* Share Modal */}
      <Modal open={isShareModalOpen} onOpenChange={setShareModalOpen}>
        <ModalContent size="lg" className="p-0">
          <ShareModal setIsOpen={setShareModalOpen} />
        </ModalContent>
      </Modal>

      {/* Profile Modal */}
      <Modal open={isProfileModalOpen} onOpenChange={setProfileModalOpen}>
        <ModalContent
          size={user ? '5xl' : 'md'}
          mobileTakeover={!!user}
          aria-label={user ? 'Settings' : 'Sign in'}
          className="p-0">
          {user ? (
            <SettingsPanel onClose={() => setProfileModalOpen(false)} />
          ) : (
            <div className="w-full p-6 sm:p-8">
              <SignInForm variant="inline" />
            </div>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}

export default PadTitle
