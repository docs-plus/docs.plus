import SignInForm from '@components/auth/SignInForm'
import ProfilePanel from '@components/profile/ProfilePanel'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { Modal, ModalContent } from '@components/ui/Dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/Popover'
import UnreadBadge from '@components/ui/UnreadBadge'
import { useNotificationCount } from '@hooks/useNotificationCount'
import { DocsPlus } from '@icons'
import { useStore } from '@stores'
import { useAuthStore } from '@stores'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import React, { useState } from 'react'
import { FaRegBell } from 'react-icons/fa'
import { MdGroup, MdHistory } from 'react-icons/md'

import { NotificationPanelSkeleton } from '../../notificationPanel/components/NotificationPanelSkeleton'
import DocTitle from '../DocTitle'
import FilterBar from './FilterBar'
import PresentUsers from './PresentUsers'
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
  const { isAuthServiceAvailable } = useStore((state) => state.settings)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [isShareModalOpen, setShareModalOpen] = useState(false)
  const { workspaceId } = useStore((state) => state.settings)

  const unreadCount = useNotificationCount({ workspaceId })

  return (
    <>
      {/* Header bar - theme-aware with border */}
      <header className="bg-base-100 border-base-300 relative z-30 flex min-h-12 w-full items-center border-b px-3 py-2">
        {/* Left section: Logo + Document info */}
        <div className="flex flex-1 items-center gap-2">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <DocsPlus size={34} />
          </Link>

          {/* Document title + sync status */}
          <div className="flex min-w-0 items-center gap-2">
            <DocTitle />
            <ProviderSyncStatus />
            <FilterBar displayRestButton={true} />
          </div>

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
            startIcon={MdGroup}
            onClick={() => setShareModalOpen(true)}>
            Share
          </Button>

          {/* History button - authenticated users only */}
          {user && (
            <Button
              variant="ghost"
              shape="circle"
              className="tooltip tooltip-bottom"
              onClick={() => (window.location.hash = 'history')}
              data-tip="History">
              <MdHistory size={20} className="text-base-content/70" />
            </Button>
          )}

          {/* Notifications - authenticated users only */}
          {isAuthServiceAvailable && user && (
            <Popover placement="bottom-end">
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  shape="circle"
                  className="tooltip tooltip-bottom relative"
                  data-tip="Notifications">
                  <FaRegBell size={18} className="text-primary" />
                  <UnreadBadge
                    count={unreadCount}
                    size="sm"
                    variant="error"
                    className="absolute -top-1 -right-2"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="rounded-box border-base-300 bg-base-100 z-50 w-[28rem] overflow-hidden border p-0 shadow-xl">
                <NotificationPanel />
              </PopoverContent>
            </Popover>
          )}

          {/* Profile / Sign in */}
          {isAuthServiceAvailable && (
            <>
              {user ? (
                <button
                  type="button"
                  className="tooltip tooltip-bottom cursor-pointer"
                  onClick={() => setProfileModalOpen(true)}
                  data-tip="Profile">
                  <Avatar
                    id={user.id}
                    src={user.avatar_url}
                    avatarUpdatedAt={user.avatar_updated_at}
                    clickable={false}
                    size="lg"
                    className="border-base-300 border shadow-md"
                  />
                </button>
              ) : (
                <Button variant="neutral" onClick={() => setProfileModalOpen(true)}>
                  Sign in
                </Button>
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
        <ModalContent size={user ? '5xl' : 'md'} className="overflow-hidden rounded-2xl p-0">
          {user ? (
            <ProfilePanel onClose={() => setProfileModalOpen(false)} />
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
