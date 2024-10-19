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
import { MdCheck, MdMenu } from 'react-icons/md'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <Loading />
})

const EditableToggle = ({ isEditable }: { isEditable: boolean }) => {
  if (isEditable) {
    return (
      <label className="flex size-10 shrink-0 items-center justify-center">
        <MdCheck size={22} />
      </label>
    )
  }

  return (
    <label
      htmlFor="mobile_left_side_panel"
      aria-label="close sidebar"
      className="btn btn-ghost drawer-button shrink-0 px-2">
      <MdMenu size={30} />
    </label>
  )
}

interface UserProfileButtonProps {
  user: any
  onProfileClick: () => void
}

const UserProfileButton = ({ user, onProfileClick }: UserProfileButtonProps) => {
  if (user) {
    return (
      <Button
        className="btn-circle btn-ghost tooltip tooltip-bottom p-0"
        onClick={onProfileClick}
        data-tip="Profile">
        <Avatar
          id={user.id}
          src={user.avatar_url}
          width={24}
          height={24}
          className="size-10 cursor-pointer rounded-full border bg-base-300 shadow-md"
        />
      </Button>
    )
  }

  return (
    <Button id="btn_signin" className="btn btn-neutral btn-sm" onClick={onProfileClick}>
      Signin
    </Button>
  )
}

const MobilePadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const {
    isAuthServiceAvailable,
    editor: { isEditable }
  } = useStore((state) => state.settings)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)

  return (
    <div className="docTitle sticky left-0 top-0 z-10 h-auto w-full bg-white">
      <div className="relative z-10 flex min-h-12 w-full flex-col items-center border-b bg-white p-2">
        <div className="flex w-full flex-row items-center justify-between">
          <div className="flex w-[80%] items-center">
            <EditableToggle isEditable={isEditable} />

            <div className="ml-2 w-[calc(100%-40px)] overflow-hidden">
              <DocTitle className="truncate text-sm font-medium" />
            </div>
          </div>

          <div className="flex w-[20%] items-center justify-end">
            <ReadOnlyIndicator />
            <UserProfileButton user={user} onProfileClick={() => setProfileModalOpen(true)} />
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
