import { ChunkLoadFallback } from '@components/ChunkLoadFallback'
import { useFadeAfterFirstSync } from '@components/pages/document/hooks/useFadeAfterFirstSync'
import { useSettingsModal } from '@components/settings/hooks/useSettingsModal'
import { SettingsTakeover } from '@components/settings/SettingsTakeover'
import type { TabType } from '@components/settings/types'
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
import { clearOverlayHash, useHashOverlay } from '@hooks/useHashOverlay'
import { useNotificationCount } from '@hooks/useNotificationCount'
import { DocsPlusIcon } from '@icons'
import { Icons } from '@icons'
import { selectIsSignedIn, selectSettingsMayOpen, useAuthStore, useStore } from '@stores'
import { useThemeStore } from '@stores'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { twMerge } from '@utils/twMerge'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import React, { useCallback, useLayoutEffect, useState } from 'react'

import { NotificationPanelSkeleton } from '../../notificationPanel/components/NotificationPanelSkeleton'
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
  { loading: (p) => <ChunkLoadFallback {...p} skeleton={<NotificationPanelSkeleton />} /> }
)

const PadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const isSignedIn = useAuthStore(selectIsSignedIn)
  const [fadeIn] = useFadeAfterFirstSync()
  const themePreference = useThemeStore((state) => state.preference)
  const setThemePreference = useThemeStore((state) => state.setPreference)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const { isOpen: isProfileModalOpen, setIsOpen: setProfileModalOpen } = useSettingsModal()
  const [isShareModalOpen, setShareModalOpen] = useState(false)
  const [isNotificationsOpen, setNotificationsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<TabType | undefined>(undefined)
  const { overlay, settingsTab: hashSettingsTab } = useHashOverlay()
  const settingsMayOpen = useAuthStore(selectSettingsMayOpen)
  const workspaceId = useStore((state) => state.settings.workspaceId)

  const unreadCount = useNotificationCount({ workspaceId })

  // No argument means the avatar button, which must not reopen the tab a hash asked for.
  const openSettings = useCallback(
    (tab?: TabType) => {
      setSettingsTab(tab)
      setProfileModalOpen(true)
    },
    [setProfileModalOpen]
  )

  // The hash is a one-shot instruction. A layout effect clears it before Settings pushes
  // its mobile history entry. While auth loads, Settings opens on its skeleton and the hash
  // waits for the profile. A signed-out reader keeps the hash, so signing in still lands.
  useLayoutEffect(() => {
    if (!overlay) return
    if (user) clearOverlayHash()
    if (overlay === 'notifications') {
      if (user) setNotificationsOpen(true)
    } else if (settingsMayOpen) openSettings(hashSettingsTab ?? undefined)
  }, [overlay, hashSettingsTab, user, settingsMayOpen, openSettings])

  return (
    <>
      {/* Header bar; `border-b` is the sole line under the title row (toolbar uses `border-b` only, no `border-t` — see EditorToolbar). */}
      <header
        className={twMerge(
          'border-base-300 bg-base-100 relative z-30 flex h-14 w-full shrink-0 items-center border-b px-3',
          fadeIn && 'motion-safe:animate-[doc-region-in_220ms_ease-out_both]'
        )}>
        {/* Left section: Logo + Document info */}
        <div className="flex flex-1 items-center gap-2">
          {/* Logo */}
          <Link
            href="/"
            className="rounded-field focus-visible:ring-primary shrink-0 focus-visible:ring-2 focus-visible:outline-none"
            aria-label="docs.plus home">
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
            btnStyle={isSignedIn ? 'outline' : undefined}
            startIcon={Icons.share}
            onClick={() => setShareModalOpen(true)}>
            Share
          </Button>

          {/* History is readable without a session. */}
          <Button
            variant="ghost"
            shape="circle"
            onClick={() => (window.location.hash = 'history')}
            tooltip="History"
            tooltipPlacement="bottom"
            aria-label="History">
            <Icons.history size={20} className="text-base-content/70" />
          </Button>

          {/* Notifications - authenticated users only */}
          {isAuthServiceAvailable && isSignedIn && (
            <Popover
              placement="bottom-end"
              open={isNotificationsOpen}
              onOpenChange={setNotificationsOpen}>
              {/* A controlled `open` disables the Popover's own `useClick`, so the bell
                  carries the toggle itself. Outside click and Esc still close it.
                  No tooltip: it stays up under the open panel while the pointer rests here. */}
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  shape="circle"
                  className="relative"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  aria-label="Notifications">
                  <Icons.notifications size={20} className="text-base-content/70" />
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
                  onClick={() => openSettings()}
                  aria-label="Profile"
                  tooltip="Profile"
                  tooltipPlacement="bottom">
                  <Avatar face={user} clickable={false} size="lg" className="pointer-events-none" />
                </Button>
              ) : isSignedIn ? (
                <div className="skeleton size-12 shrink-0 rounded-full" aria-hidden />
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
                      <Icons.moon size={20} className="text-base-content/70" />
                    ) : themePreference === 'system' ? (
                      <Icons.monitor size={20} className="text-base-content/70" />
                    ) : (
                      <Icons.sun size={20} className="text-base-content/70" />
                    )}
                  </Button>
                  <Button variant="neutral" onClick={() => openInlineSignInDialog()}>
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
        <ModalContent size="2xl" className="p-0">
          <ShareModal setIsOpen={setShareModalOpen} />
        </ModalContent>
      </Modal>

      <SettingsTakeover
        open={isProfileModalOpen}
        onOpenChange={setProfileModalOpen}
        defaultTab={settingsTab}
      />
    </>
  )
}

export default PadTitle
