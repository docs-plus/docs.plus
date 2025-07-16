import DocTitle from '../DocTitle'
import ReadOnlyIndicator from './ReadOnlyIndicator'
import FilterBar from './FilterBar'
import { useStore } from '@stores'
import Modal from '@components/ui/Modal'
import React, { useState } from 'react'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import { MdMenu, MdInsertComment } from 'react-icons/md'
import ProfilePanel from '@components/pages/panels/profile/ProfilePanel'
import TabLayout from '@components/pages/TabLayout'
import SignInPanel from '@components/pages/panels/SignInPanel'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { BiCheck, BiUndo, BiRedo } from 'react-icons/bi'
import { useNotificationCount } from '@hooks/useNotificationCount'
import { useBottomSheet } from '@hooks/useBottomSheet'
interface UserProfileButtonProps {
  user: any
  onProfileClick: () => void
}

interface UndoRedoButtonsProps {
  editor: any
  className?: string
}

const EditableToggle = ({ isEditable }: { isEditable: boolean }) => {
  if (isEditable) {
    return (
      <ToolbarButton className="text-docsy size-12">
        <BiCheck size={32} />
      </ToolbarButton>
    )
  }

  return (
    <label
      htmlFor="mobile_left_side_panel"
      aria-label="close sidebar"
      className="btn drawer-button btn-ghost btn-square">
      <MdMenu size={30} />
    </label>
  )
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
          avatarUpdatedAt={user.avatar_updated_at}
          clickable={false}
          src={user.avatar_url}
          width={24}
          height={24}
          className="bg-base-300 size-10 cursor-pointer rounded-full border shadow-md"
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

const NotificationButton = () => {
  const { openNotifications } = useBottomSheet()
  const { workspaceId } = useStore((state) => state.settings)
  const unreadCount = useNotificationCount({ workspaceId })

  return (
    <Button
      className="btn-ghost tooltip tooltip-bottom relative p-2"
      data-tip="Notifications"
      onClick={openNotifications}>
      <MdInsertComment size={26} className="text-docsy" />
      {unreadCount > 0 && (
        <div className="absolute top-[2px] right-[2px] flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {unreadCount}
        </div>
      )}
    </Button>
  )
}

const UndoRedoButtons = ({ editor, className }: UndoRedoButtonsProps) => {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex items-center gap-3">
        <ToolbarButton onClick={() => editor?.commands.undo()} editor={editor} type="undo">
          <BiUndo size={26} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor?.commands.redo()} editor={editor} type="redo">
          <BiRedo size={26} />
        </ToolbarButton>
      </div>
      <span className="divider divider-horizontal"></span>
    </div>
  )
}

const MobilePadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const {
    editor: { isEditable, instance: editor }
  } = useStore((state) => state.settings)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)

  return (
    <>
      <div className="docTitle sticky top-0 left-0 z-10 h-auto w-full bg-white">
        <div className="relative z-10 flex min-h-12 w-full flex-col items-center border-b border-gray-300 bg-white p-2">
          <div className="flex w-full flex-row items-center justify-between gap-4">
            <div className="flex w-[80%] items-center gap-2">
              <EditableToggle isEditable={isEditable} />

              {isEditable ? (
                <UndoRedoButtons editor={editor} className="ml-4" />
              ) : (
                <div className="w-[calc(100%-40px)] overflow-hidden">
                  <DocTitle className="truncate text-sm font-medium" />
                </div>
              )}
            </div>

            <div className="flex w-[20%] items-center justify-end gap-2">
              <ReadOnlyIndicator />
              <NotificationButton />
              <UserProfileButton user={user} onProfileClick={() => setProfileModalOpen(true)} />
            </div>
          </div>
          <div className="w-full">
            <FilterBar />
          </div>
        </div>
      </div>

      <Modal
        asAChild={false}
        id="modal_profile"
        isOpen={isProfileModalOpen}
        setIsOpen={setProfileModalOpen}>
        {user ? (
          <TabLayout name="profile" className="h-full max-h-[94%] max-w-[64rem]">
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

export default MobilePadTitle
