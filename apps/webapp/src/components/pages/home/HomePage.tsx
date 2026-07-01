import SettingsPanelSkeleton from '@components/settings/SettingsPanelSkeleton'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { Modal, ModalContent } from '@components/ui/Dialog'
import Loading from '@components/ui/Loading'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'
import { DocsPlusIcon } from '@icons'
import { useAuthStore, useStore } from '@stores'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { LuUser } from 'react-icons/lu'
import { twMerge } from 'tailwind-merge'

import { HomeActionCard } from './HomeActionCard'
import { HomeCollapseRegion } from './HomeCollapseRegion'
import { HomeFooter } from './HomeFooter'
import { HomeHero } from './HomeHero'
import { HOME_MOBILE_MQ, HOME_REGION_DURATION, homeRegionEase } from './homeMobileLayout'
import { useNavigateToDocument } from './hooks/useNavigateToDocument'

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

const SignInForm = dynamic(() => import('@components/auth/SignInForm'), {
  loading: () => <Loading />
})
const SettingsPanel = dynamic(() => import('@components/settings/SettingsPanel'), {
  loading: () => <SettingsPanelSkeleton />
})

interface HomePageProps {
  hostname: string
  isAuthServiceAvailable: boolean
}

const HomePage = ({ hostname, isAuthServiceAvailable }: HomePageProps) => {
  const user = useAuthStore((state) => state.profile)
  const [displayHostname, setDisplayHostname] = useState(hostname)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const { navigateToDocument, isLoading } = useNavigateToDocument()
  useVirtualKeyboard({ activeMq: HOME_MOBILE_MQ, clearStoreOnDisable: true })
  const keyboardCompact = useStore((state) => state.isKeyboardOpen)

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
      <a
        href="#home-main"
        className="btn btn-primary btn-sm sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50">
        Skip to main content
      </a>

      <div
        className={twMerge(
          'bg-base-200 flex flex-col overflow-hidden',
          // Mobile: pin the shell to the visual viewport rect so the iOS keyboard cannot scroll
          // the page off-screen; top/left/width track `--visual-viewport-*` (synced on focus/resize).
          'max-sm:fixed max-sm:top-[var(--visual-viewport-offset-top,0px)] max-sm:left-[var(--visual-viewport-offset-left,0px)] max-sm:w-[var(--visual-viewport-width,100%)]'
        )}
        style={{ height: 'var(--visual-viewport-height, 100dvh)' }}>
        <header className="flex shrink-0 items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <DocsPlusIcon size={28} className="sm:size-10" />
            <span className="text-base-content mt-1 text-lg font-bold sm:text-2xl">docs.plus</span>
          </div>

          {isAuthServiceAvailable && (
            <div className="flex items-center gap-2">
              {user ? (
                <Button
                  variant="ghost"
                  shape="circle"
                  size="lg"
                  className="border-0 p-0 transition-transform hover:scale-105"
                  onClick={() => setIsProfileOpen(true)}
                  aria-label="Open profile settings"
                  aria-haspopup="dialog"
                  tooltip="Profile"
                  tooltipPlacement="bottom">
                  <Avatar
                    src={user.avatar_url}
                    avatarUpdatedAt={user.avatar_updated_at}
                    id={user.id}
                    alt={user.display_name}
                    clickable={false}
                    size="lg"
                    className="border-base-300 pointer-events-none border shadow-md"
                  />
                </Button>
              ) : (
                <Button
                  shape="circle"
                  className="btn-soft btn-primary size-11 border-0 sm:size-12"
                  onClick={() => setIsSignInOpen(true)}
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
          className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-y-contain px-4 max-sm:py-2 sm:justify-center sm:py-12">
          <HomeFlexSpacer compact={keyboardCompact} />
          <div id="home-action-block" className="w-full max-w-2xl shrink-0">
            <HomeHero compact={keyboardCompact} />
            <HomeActionCard
              hostname={displayHostname}
              isLoading={isLoading}
              onNavigate={navigateToDocument}
              compact={keyboardCompact}
            />
            <HomeCollapseRegion
              collapsed={keyboardCompact}
              className={keyboardCompact ? 'max-sm:mt-0' : 'mt-8 sm:mt-12'}>
              <div className="text-base-content/50 space-y-1 text-center text-xs motion-safe:animate-[doc-content-in_180ms_ease-out_120ms_both] sm:space-y-2 sm:text-sm">
                <p>
                  A{' '}
                  <a
                    href="https://github.com/docs-plus"
                    className="text-primary font-medium hover:underline">
                    free & open source
                  </a>{' '}
                  project by{' '}
                  <a
                    href="https://newspeak.house"
                    className="text-primary font-medium hover:underline">
                    Newspeak House
                  </a>
                </p>
                <p>
                  Seed funded by{' '}
                  <a
                    href="https://www.grantfortheweb.org"
                    className="text-primary font-medium hover:underline">
                    Grant for Web
                  </a>{' '}
                  &{' '}
                  <a
                    href="https://www.nesta.org.uk"
                    className="text-primary font-medium hover:underline">
                    Nesta
                  </a>
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

      {user && (
        <Modal open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <ModalContent size="4xl" aria-label="Profile settings" className="overflow-hidden p-0">
            <SettingsPanel onClose={() => setIsProfileOpen(false)} />
          </ModalContent>
        </Modal>
      )}

      {isAuthServiceAvailable && !user && (
        <Modal open={isSignInOpen} onOpenChange={setIsSignInOpen}>
          <ModalContent size="sm" aria-label="Sign in" className="overflow-hidden p-0">
            <SignInForm variant="card" showHeader onClose={() => setIsSignInOpen(false)} />
          </ModalContent>
        </Modal>
      )}
    </>
  )
}

export default HomePage
