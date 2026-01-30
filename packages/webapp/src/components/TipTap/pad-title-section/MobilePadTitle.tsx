import SignInForm from '@components/auth/SignInForm'
import ProfilePanel from '@components/profile/ProfilePanel'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { Modal, ModalContent } from '@components/ui/Dialog'
import UnreadBadge from '@components/ui/UnreadBadge'
import { useBottomSheet } from '@hooks/useBottomSheet'
import { useNotificationCount } from '@hooks/useNotificationCount'
import { useStore } from '@stores'
import { useAuthStore } from '@stores'
import React, { useState } from 'react'
import { BiCheck, BiRedo,BiUndo } from 'react-icons/bi'
import { MdMenu, MdNotifications } from 'react-icons/md'

import DocTitle from '../DocTitle'
import FilterBar from './FilterBar'
import ReadOnlyIndicator from './ReadOnlyIndicator'

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
      <ToolbarButton className="text-primary size-8">
        <BiCheck size={32} />
      </ToolbarButton>
    )
  }

  return (
    <label
      htmlFor="mobile_left_side_panel"
      aria-label="close sidebar"
      className="btn btn-ghost btn-square size-9">
      <MdMenu size={28} className="text-base-content" />
    </label>
  )
}

const UserProfileButton = ({ user, onProfileClick }: UserProfileButtonProps) => {
  if (user) {
    return (
      <Button
        variant="ghost"
        shape="circle"
        className="tooltip tooltip-bottom p-0"
        onClick={onProfileClick}
        data-tip="Profile">
        <Avatar
          id={user.id}
          avatarUpdatedAt={user.avatar_updated_at}
          clickable={false}
          src={user.avatar_url}
          size="md"
          className="border-base-300 cursor-pointer border shadow-md"
        />
      </Button>
    )
  }

  return (
    <Button variant="neutral" size="sm" onClick={onProfileClick}>
      Sign in
    </Button>
  )
}

const NotificationButton = () => {
  const { openNotifications } = useBottomSheet()
  const { workspaceId } = useStore((state) => state.settings)
  const unreadCount = useNotificationCount({ workspaceId })

  return (
    <Button
      variant="ghost"
      className="tooltip tooltip-bottom relative p-2"
      data-tip="Notifications"
      onClick={openNotifications}>
      <MdNotifications
        size={24}
        className={unreadCount > 0 ? 'text-primary' : 'text-base-content/70'}
      />
      <UnreadBadge
        count={unreadCount}
        size="xs"
        variant="error"
        className="absolute top-0.5 right-0.5"
      />
    </Button>
  )
}

const UndoRedoButtons = ({ editor, className }: UndoRedoButtonsProps) => {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex items-center gap-2">
        <ToolbarButton
          onClick={() => editor?.commands.undo()}
          editor={editor}
          type="undo"
          className="size-9">
          <BiUndo size={24} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.commands.redo()}
          editor={editor}
          type="redo"
          className="size-9">
          <BiRedo size={24} />
        </ToolbarButton>
      </div>
      <div className="divider divider-horizontal mx-2" />
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
      {/* Sticky mobile header - theme-aware */}
      <header className="bg-base-100 sticky top-0 left-0 z-30 w-full">
        <div className="border-base-300 flex min-h-12 w-full flex-col border-b px-2 py-2">
          {/* Main row */}
          <div className="flex w-full items-center justify-between gap-2">
            {/* Left section */}
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <EditableToggle isEditable={isEditable} />

              {isEditable ? (
                <UndoRedoButtons editor={editor} className="ml-2" />
              ) : (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <DocTitle className="truncate text-sm font-medium" />
                </div>
              )}
            </div>

            {/* Right section */}
            <div className="flex shrink-0 items-center gap-1">
              <ReadOnlyIndicator />
              <NotificationButton />
              <UserProfileButton user={user} onProfileClick={() => setProfileModalOpen(true)} />
            </div>
          </div>

          {/* Filter bar row */}
          <div className="w-full">
            <FilterBar />
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      <Modal open={isProfileModalOpen} onOpenChange={setProfileModalOpen}>
        <ModalContent size={user ? '4xl' : 'md'} className="overflow-hidden rounded-2xl p-0">
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

export default MobilePadTitle
