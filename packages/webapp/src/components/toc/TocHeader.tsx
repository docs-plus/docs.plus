import { ChatLeft } from '@icons'
import { useChatStore, useStore } from '@stores'
import { useTocActions, usePresentUsers, useUnreadCount } from './hooks'
import { scrollToDocTitle } from './utils'
import AvatarStack from '@components/AvatarStack'
import { useModal } from '@components/ui/ModalDrawer'
import UnreadBadge from '@components/ui/UnreadBadge'

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
      <div className="border-base-300 border-b">
        <div className="group relative flex items-center justify-between py-2">
          <span className="text-base-content text-lg font-bold">{docMetadata?.title}</span>
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
    <div className="border-base-300 relative w-full border-b pb-1">
      <div
        className={`group hover:bg-base-300/50 flex cursor-pointer items-center justify-between gap-0.5 rounded-md p-1 px-2 pr-3 ${isActive && 'activeTocBorder bg-base-300'}`}
        onClick={handleClick}>
        <span className="text-base-content text-lg font-bold">{docMetadata?.title}</span>
        <span
          className="btn_chat tooltip tooltip-top relative ml-auto"
          onClick={handleChatClick}
          data-tip="Chat Room">
          {unreadCount > 0 ? (
            <UnreadBadge count={unreadCount} size="sm" />
          ) : (
            <ChatLeft
              className="btnChat text-base-content/60 hover:text-primary ml-1 cursor-pointer transition-all"
              size={16}
            />
          )}
        </span>
        <div className="absolute -right-9">
          {presentUsers.length > 0 && (
            <AvatarStack
              size="sm"
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
