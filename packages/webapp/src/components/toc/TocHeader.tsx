import { ChatLeft } from '@icons'
import { useChatStore, useStore } from '@stores'
import { useTocActions, usePresentUsers, useUnreadCount } from './hooks'
import { scrollToDocTitle } from './utils'
import AvatarStack from '@components/AvatarStack'
import { useModal } from '@components/ui/ModalDrawer'

interface TocHeaderProps {
  variant: 'desktop' | 'mobile'
}

export function TocHeader({ variant }: TocHeaderProps) {
  const { metadata: docMetadata, workspaceId } = useStore((state) => state.settings)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const unreadCount = useUnreadCount(workspaceId || '')
  const presentUsers = usePresentUsers(workspaceId || '')
  const { openChatroom } = useTocActions()
  const { close: closeModal } = variant === 'mobile' ? useModal() || {} : {}

  const isActive = headingId === workspaceId

  const handleClick = () => {
    scrollToDocTitle({
      workspaceId,
      title: docMetadata?.title,
      openChatRoom: true
    })
    if (variant === 'mobile') {
      closeModal?.()
    }
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (workspaceId) {
      openChatroom(workspaceId)
    }
    if (variant === 'mobile') {
      closeModal?.()
    }
  }

  if (variant === 'mobile') {
    return (
      <div className="border-b border-gray-300">
        <div className="group relative flex items-center justify-between py-2">
          <span className="text-lg font-bold">{docMetadata?.title}</span>
          <span
            className="btn_openChatBox bg-neutral text-neutral-content flex items-center justify-end overflow-hidden"
            onClick={handleChatClick}
            data-unread-count={unreadCount > 0 ? unreadCount : ''}>
            <ChatLeft
              className={`chatLeft fill-neutral-content ${isActive && '!fill-accent'}`}
              size={14}
            />
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative border-b border-gray-300 pb-1">
      <div
        className={`group flex cursor-pointer items-center justify-between rounded-md p-1 px-2 pr-3 hover:bg-gray-300 hover:bg-opacity-50 ${isActive && 'activeTocBorder bg-gray-300'}`}
        onClick={handleClick}>
        <span className="text-lg font-bold">{docMetadata?.title}</span>
        <span
          className="btn_chat tooltip tooltip-top relative ml-auto"
          onClick={handleChatClick}
          data-tip="Chat Room">
          {unreadCount > 0 && (
            <div className="badge badge-docsy badge-sm bg-docsy border-docsy absolute top-1/2 z-[1] -translate-y-1/2 scale-90 border border-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
          <ChatLeft
            className={`btnChat ml-1 ${unreadCount > 0 && 'hidden'} group-hover:fill-docsy cursor-pointer transition-all hover:fill-indigo-900`}
            size={16}
          />
        </span>
        <div className="absolute -right-9">
          {presentUsers.length > 0 && (
            <AvatarStack
              size={8}
              users={presentUsers}
              showStatus={true}
              tooltipPosition="tooltip-left"
            />
          )}
        </div>
      </div>
    </div>
  )
}
