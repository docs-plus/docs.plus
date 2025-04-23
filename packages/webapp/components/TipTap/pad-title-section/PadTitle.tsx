import Link from 'next/link'
import { DocsPlus } from '@icons'
import DocTitle from '../DocTitle'
import PresentUsers from './PresentUsers'
import ReadOnlyIndicator from './ReadOnlyIndicator'
import FilterBar from './FilterBar'
import { useStore } from '@stores'
import Modal from '@components/ui/Modal'
import React, { useState } from 'react'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import ShareModal from './ShareModal'
import { PrivateShare } from '@icons'
import ProfilePanel from '@components/pages/panels/profile/ProfilePanel'
import TabLayout from '@components/pages/TabLayout'
import SignInPanel from '@components/pages/panels/SignInPanel'
import { FaRegBell } from 'react-icons/fa'
import { NotificationPanel } from '../../notificationPanel/desktop/NotificationPanel'
import Dropdown from '@components/ui/Dropdown'
import { MdHistory } from 'react-icons/md'
import { useNotificationCount } from '@hooks/useNotificationCount'

const PadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const { isAuthServiceAvailable } = useStore((state) => state.settings)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [isShareModalOpen, setShareModalOpen] = useState(false)
  const { workspaceId } = useStore((state) => state.settings)

  const unreadCount = useNotificationCount({ workspaceId })

  return (
    <>
      <div className="docTitle relative z-10 flex min-h-12 w-full flex-row items-center bg-white p-2">
        <div className="flex w-full flex-row items-center align-middle">
          <div className="padLog">
            <Link href="/">
              <DocsPlus size={34} />
            </Link>
          </div>

          <div className="flex items-center justify-start align-middle">
            <DocTitle />
            <FilterBar displayRestButton={true} />
          </div>

          <ReadOnlyIndicator />

          <div className="mr-3 ml-auto flex items-center justify-center space-x-4">
            {isAuthServiceAvailable && <PresentUsers />}

            <Button
              className="btn-primary tooltip tooltip-bottom flex h-[38px] min-h-[38px] items-center gap-2 text-white"
              onClick={() => setShareModalOpen(true)}
              data-tip="Share">
              <div className="flex items-center gap-2">
                <PrivateShare size={16} />
                <div className="h-4 w-[1px] bg-white/20"></div>
                <span>Share</span>
              </div>
            </Button>

            <Button
              className="btn-circle btn-ghost btn-outline tooltip tooltip-bottom relative h-[42px] min-h-[42px] w-[42px] border-gray-200"
              onClick={() => (window.location.hash = 'history')}
              data-tip="History">
              <MdHistory size={22} />
            </Button>

            {isAuthServiceAvailable && (
              <Dropdown
                className="dropdown-bottom dropdown-end"
                button={
                  <Button
                    className="btn-circle btn-ghost btn-outline tooltip tooltip-bottom relative h-[42px] min-h-[42px] w-[42px] border-gray-200"
                    data-tip="Notifications">
                    <FaRegBell size={20} fill="currentColor" className="text-primary" />
                    {unreadCount > 0 && (
                      <div className="badge badge-sm bg-docsy absolute -top-1 -right-2 rounded-md border-0 text-white">
                        {unreadCount}
                      </div>
                    )}
                  </Button>
                }>
                <NotificationPanel />
              </Dropdown>
            )}
            {isAuthServiceAvailable && (
              <div className="flex">
                {user ? (
                  <Button
                    className="btn-circle btn-ghost tooltip tooltip-bottom h-[42px] min-h-[42px] w-[42px]"
                    onClick={() => setProfileModalOpen(true)}
                    data-tip="Profile">
                    <Avatar
                      id={user.id}
                      src={user.avatar_url}
                      avatarUpdatedAt={user.avatar_updated_at}
                      width={24}
                      height={24}
                      clickable={false}
                      className="h-[42px] min-h-[42px] w-[42px] cursor-pointer rounded-full border border-gray-300 shadow-md"
                    />
                  </Button>
                ) : (
                  <Button
                    id="btn_signin"
                    className="btn btn-neutral h-[2.6rem] min-h-[2.6rem]"
                    onClick={() => setProfileModalOpen(true)}>
                    Signin
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal id="modal_share" isOpen={isShareModalOpen} setIsOpen={setShareModalOpen}>
        <ShareModal setIsOpen={setShareModalOpen} />
      </Modal>

      <Modal
        asAChild={false}
        id="modal_profile"
        isOpen={isProfileModalOpen}
        setIsOpen={setProfileModalOpen}>
        {user ? (
          <TabLayout name="profile" className="max-w-[64rem]">
            <ProfilePanel />
          </TabLayout>
        ) : (
          <TabLayout name="sign-in" footer={false} className="w-full p-6 sm:w-[28rem] sm:p-6">
            <SignInPanel />
          </TabLayout>
        )}
      </Modal>
    </>
  )
}

export default PadTitle
