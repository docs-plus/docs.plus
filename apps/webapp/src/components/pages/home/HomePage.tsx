import { CommandJump } from '@components/commandJump/CommandJump'
import { ownerDocumentsPrefix } from '@components/settings/documentsQueryKey'
import { useSettingsModal } from '@components/settings/hooks/useSettingsModal'
import { SettingsTakeover } from '@components/settings/SettingsTakeover'
import type { TabType } from '@components/settings/types'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import { TextLink } from '@components/ui/TextLink'
import { clearOverlayHash, useHashOverlay } from '@hooks/useHashOverlay'
import { useNavigateToDocument } from '@hooks/useNavigateToDocument'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'
import { useAuthStore, useStore } from '@stores'
import { useQueryClient } from '@tanstack/react-query'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { twMerge } from '@utils/twMerge'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LuUser } from 'react-icons/lu'

import { BrandLockup } from './BrandLockup'
import { HomeActionCard } from './HomeActionCard'
import { HomeCollapseRegion } from './HomeCollapseRegion'
import { HomeFooter } from './HomeFooter'
import { HomeHero } from './HomeHero'
import { HomeInstallButton } from './HomeInstallButton'
import { HOME_MOBILE_MQ, HOME_REGION_DURATION, homeRegionEase } from './homeMobileLayout'
import { SkipLink } from './SkipLink'

// Loads only after the profile arrives, so a signed-out visitor fetches none of the list code.
const HomeDocuments = dynamic(() => import('./HomeDocuments').then((m) => m.HomeDocuments), {
  ssr: false
})

const HOME_FLEX_SPACER = 'motion-safe:transition-[flex-grow] max-sm:min-h-0 max-sm:shrink'

function HomeFlexSpacer({ compact }: { compact: boolean }) {
  return (
    <div
      className={twMerge(
        HOME_FLEX_SPACER,
        HOME_REGION_DURATION,
        homeRegionEase(compact),
        compact ? 'max-sm:flex-grow-0' : 'max-sm:flex-grow'
      )}
      aria-hidden
    />
  )
}

interface HomePageProps {
  hostname: string
  isAuthServiceAvailable: boolean
}

const HomePage = ({ hostname, isAuthServiceAvailable }: HomePageProps) => {
  const user = useAuthStore((state) => state.profile)
  const [displayHostname, setDisplayHostname] = useState(hostname)
  const { isOpen: isProfileOpen, setIsOpen: setIsProfileOpen } = useSettingsModal()
  const [settingsTab, setSettingsTab] = useState<TabType | undefined>(undefined)
  const { overlay, settingsTab: hashSettingsTab } = useHashOverlay()
  const { navigateToDocument, isLoading } = useNavigateToDocument()
  useVirtualKeyboard({ activeMq: HOME_MOBILE_MQ, clearStoreOnDisable: true })
  const keyboardCompact = useStore((state) => state.isKeyboardOpen)
  const queryClient = useQueryClient()
  const wasProfileOpenRef = useRef(false)

  // No argument means the header button, which must not reopen the tab a hash asked for.
  const openSettings = useCallback(
    (tab?: TabType) => {
      setSettingsTab(tab)
      setIsProfileOpen(true)
    },
    [setIsProfileOpen]
  )

  // The hash is a one-shot instruction. Clear it first, before the panel pushes its own
  // mobile history entry. A signed-out visitor keeps the hash, so signing in still lands.
  useEffect(() => {
    if (overlay !== 'settings' || !user) return
    clearOverlayHash()
    openSettings(hashSettingsTab ?? undefined)
  }, [overlay, hashSettingsTab, user, openSettings])

  // A rename re-sorts and a Trash restore returns rows only on a refetch, and closing
  // Settings fires no focus event. Watch the state: mobile back skips `onOpenChange`.
  useEffect(() => {
    const wasOpen = wasProfileOpenRef.current
    wasProfileOpenRef.current = isProfileOpen
    if (!wasOpen || isProfileOpen || !user) return
    void queryClient.invalidateQueries({ queryKey: ownerDocumentsPrefix(user.id) })
  }, [isProfileOpen, user, queryClient])

  useEffect(() => {
    useStore.getState().setWorkspaceSetting('metadata', { documentId: undefined })
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.host) {
      setDisplayHostname(window.location.host)
    }
  }, [])

  return (
    <>
      <SkipLink targetId="home-main" />

      <div
        className={twMerge(
          'bg-base-200 flex flex-col',
          // Mobile: pin the shell to the visual viewport rect so the iOS keyboard cannot scroll
          // the page off-screen; top/left/width track `--visual-viewport-*` (synced on focus/resize).
          'max-sm:fixed max-sm:top-[var(--visual-viewport-offset-top,0px)] max-sm:left-[var(--visual-viewport-offset-left,0px)] max-sm:h-[var(--visual-viewport-height,100dvh)] max-sm:w-[var(--visual-viewport-width,100%)] max-sm:overflow-hidden',
          // Desktop scrolls as one page, so the footer follows a tall Home instead of clipping it.
          'sm:min-h-dvh'
        )}>
        <header className="flex shrink-0 items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4">
          <BrandLockup />

          {isAuthServiceAvailable && (
            <div className="flex items-center gap-2">
              {user ? (
                <Button
                  variant="ghost"
                  shape="circle"
                  size="lg"
                  className="border-0 p-0 transition-transform hover:scale-105"
                  onClick={() => openSettings()}
                  aria-label="Open profile settings"
                  aria-haspopup="dialog"
                  tooltip="Profile"
                  tooltipPlacement="bottom">
                  <Avatar face={user} clickable={false} size="lg" className="pointer-events-none" />
                </Button>
              ) : (
                <Button
                  shape="circle"
                  className="btn-soft btn-primary size-11 border-0 sm:size-12"
                  onClick={() => openInlineSignInDialog()}
                  aria-label="Sign in"
                  tooltip="Sign in"
                  tooltipPlacement="bottom">
                  <LuUser className="size-5 sm:size-6" />
                </Button>
              )}
            </div>
          )}
        </header>

        <main
          id="home-main"
          className="flex min-h-0 flex-1 flex-col items-center px-4 max-sm:overflow-y-auto max-sm:overscroll-y-contain max-sm:py-2 sm:py-12">
          <HomeFlexSpacer compact={keyboardCompact} />
          {/* Auto margins, not justify-center: a tall Home then overflows at the bottom only. */}
          <div id="home-action-block" className="w-full max-w-2xl shrink-0 sm:my-auto">
            <HomeHero compact={keyboardCompact} />
            <HomeActionCard
              hostname={displayHostname}
              isLoading={isLoading}
              onNavigate={navigateToDocument}
              compact={keyboardCompact}
            />
            <HomeCollapseRegion collapsed={keyboardCompact}>
              {user && isAuthServiceAvailable && (
                <HomeDocuments userId={user.id} onSeeAll={() => openSettings('documents')} />
              )}
              <HomeInstallButton />
            </HomeCollapseRegion>
            <HomeCollapseRegion
              collapsed={keyboardCompact}
              className={keyboardCompact ? 'max-sm:mt-0' : 'mt-8 sm:mt-12'}>
              <div className="text-base-content/70 space-y-1 text-center text-xs motion-safe:animate-[doc-content-in_180ms_ease-out_120ms_both] sm:space-y-2 sm:text-sm">
                <p>
                  A <TextLink href="https://github.com/docs-plus">free & open source</TextLink>{' '}
                  project by <TextLink href="https://newspeak.house">Newspeak House</TextLink>
                </p>
                <p>
                  Seed funded by{' '}
                  <TextLink href="https://www.grantfortheweb.org">Grant for Web</TextLink> &{' '}
                  <TextLink href="https://www.nesta.org.uk">Nesta</TextLink>
                </p>
              </div>
            </HomeCollapseRegion>
          </div>
          <HomeFlexSpacer compact={keyboardCompact} />
        </main>

        <HomeCollapseRegion collapsed={keyboardCompact}>
          <HomeFooter />
        </HomeCollapseRegion>
      </div>

      <SettingsTakeover
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        defaultTab={settingsTab}
      />

      {/* Settings confirms (rename/trash/private) dispatch here; without this mount they render nothing on `/`. */}
      <GlobalDialog />

      <CommandJump surface="home" />
    </>
  )
}

export default HomePage
