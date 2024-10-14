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
import { FaCheck } from 'react-icons/fa6'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <Loading />
})

const MobilePadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const isKeyboardOpen = useDetectKeyboardOpen()
  const { isAuthServiceAvailable } = useStore((state) => state.settings)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)

  return (
    <div className="docTitle sticky left-0 top-0 z-10 h-auto w-full bg-white">
      <div className="relative z-10 flex min-h-12 w-full flex-col items-center border-b bg-white p-2">
        <div className="flex w-full flex-row items-center justify-between">
          <div className="flex w-[80%] items-center">
            {isKeyboardOpen ? (
              <label
                htmlFor="mobile_left_side_panel"
                aria-label="close sidebar"
                className="flex size-10 shrink-0 items-center justify-center">
                <FaCheck size={20} />
              </label>
            ) : (
              <label
                htmlFor="mobile_left_side_panel"
                className="btn btn-ghost drawer-button shrink-0 px-2">
                <Hamburger size={30} />
              </label>
            )}

            <div className="ml-2 w-[calc(100%-40px)] overflow-hidden">
              <DocTitle className="truncate text-sm font-medium" />
            </div>
          </div>

          <div className="flex w-[20%] items-center justify-end">
            <ReadOnlyIndicator />

            {isAuthServiceAvailable && (
              <div className="ml-2">
                {user ? (
                  <Button
                    className="btn-circle btn-ghost tooltip tooltip-bottom p-0"
                    onClick={() => setProfileModalOpen(true)}
                    data-tip="Profile">
                    <Avatar
                      id={user.id}
                      src={user.avatar_url}
                      width={24}
                      height={24}
                      className="size-8 cursor-pointer rounded-full border shadow-xl"
                    />
                  </Button>
                ) : (
                  <Button
                    id="btn_signin"
                    className="btn btn-neutral btn-sm"
                    onClick={() => setProfileModalOpen(true)}>
                    Signin
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="w-full">
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
    </div>
  )
}

export default MobilePadTitle
