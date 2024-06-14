import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import { Hamburger, Check } from '@icons'
import DocTitle from '../DocTitle'
import ReadOnlyIndicator from './ReadOnlyIndicator'
import FilterBar from './FilterBar'
import { useStore } from '@stores'
import Modal from '@components/ui/Modal'
import dynamic from 'next/dynamic'
import React, { useState } from 'react'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import Loading from '@components/ui/Loading'
import TocModal from '@components/pages/document/components/TocModal'
import { FaCheck } from 'react-icons/fa6'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <Loading />
})

const MobileLeftSidePanel = () => {
  return (
    <div className="drawer z-30">
      <input id="mobile_left_side_panel" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content">
        <label htmlFor="mobile_left_side_panel" className="btn btn-ghost drawer-button px-2">
          <Hamburger size={30} />
        </label>
      </div>
      <div className="drawer-side">
        <label
          htmlFor="mobile_left_side_panel"
          aria-label="close sidebar"
          className="drawer-overlay"></label>
        <div className="min-h-full">
          <label htmlFor="mobile_left_side_panel">
            <TocModal />
          </label>
        </div>
      </div>
    </div>
  )
}

const MobilePadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const isKeyboardOpen = useDetectKeyboardOpen()
  const { isAuthServiceAvailable } = useStore((state) => state.settings)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)

  return (
    <>
      <div className="docTitle relative z-10 flex min-h-12 w-full flex-col items-center border-b bg-white p-2">
        <div className="flex w-full flex-row items-center align-middle ">
          <div className="">
            {isKeyboardOpen ? (
              <label
                htmlFor="mobile_left_side_panel"
                aria-label="close sidebar"
                className="flex size-10 items-center justify-center align-middle">
                <FaCheck size={20} />
              </label>
            ) : (
              <MobileLeftSidePanel />
            )}
          </div>

          <div className="flex items-center justify-start align-middle">
            <DocTitle />
          </div>

          <ReadOnlyIndicator />

          <div className="ml-auto flex items-center justify-center">
            {isAuthServiceAvailable && (
              <div className="ml-5 mr-2">
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
        <div className="mr-auto pl-10">
          <FilterBar />
        </div>
      </div>

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

export default MobilePadTitle
