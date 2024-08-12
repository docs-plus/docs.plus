import Link from 'next/link'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import { DocsPlus, Hamburger, Check } from '@icons'
import DocTitle from '../DocTitle'
import PresentUsers from './PresentUsers'
import ReadOnlyIndicator from './ReadOnlyIndicator'
import FilterBar from './FilterBar'
import { useStore } from '@stores'
import Modal from '@components/ui/Modal'
import dynamic from 'next/dynamic'
import React, { useState } from 'react'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import ShareModal from './ShareModal'
import { PrivateShare } from '@icons'
import Loading from '@components/ui/Loading'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <Loading />
})

const PadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const { isAuthServiceAvailable } = useStore((state) => state.settings)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [isShareModalOpen, setShareModalOpen] = useState(false)

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

          <div className="ml-auto flex items-center justify-center">
            {isAuthServiceAvailable && <PresentUsers />}
            <Button
              className="btn-primary btn-wide ml-3 h-[2.6rem] min-h-[2.6rem] max-w-28 text-white"
              onClick={() => setShareModalOpen(true)}>
              <PrivateShare />
              Share
            </Button>
            {isAuthServiceAvailable && (
              <div className="ml-5 mr-2 flex">
                {user ? (
                  <Button
                    className="btn-circle btn-ghost tooltip tooltip-bottom"
                    onClick={() => setProfileModalOpen(true)}
                    data-tip="Profile">
                    <Avatar
                      id={user.id}
                      src={user.avatar_url}
                      width={24}
                      height={24}
                      className="size-11 cursor-pointer rounded-full border shadow-xl"
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
        <ControlCenter defaultTab="profile" />
      </Modal>
    </>
  )
}

export default PadTitle
