import AvatarStack from '@components/AvatarStack'
import { useModal } from '@components/ui/ModalDrawer'
import UnreadBadge from '@components/ui/UnreadBadge'
import { ChatLeft } from '@icons'
import { useChatStore, useStore } from '@stores'

import { usePresentUsers, useTocActions, useUnreadCount } from './hooks'
import { scrollToDocTitle } from './utils'

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
      <div className="border-base-300 bg-base-100 sticky top-0 z-10 border-b">
        <div className="group relative flex items-center justify-between py-2">
          <span className="text-base-content text-lg font-bold">{docMetadata?.title}</span>
          <button
            className="flex size-8 items-center justify-center rounded-full"
            onClick={handleChatClick}
            aria-label={unreadCount > 0 ? `${unreadCount} unread — open chat` : 'Open chat'}>
            {unreadCount > 0 ? (
              <UnreadBadge count={unreadCount} size="sm" variant="error" />
            ) : (
              <ChatLeft
                fill="currentColor"
                className={`text-base-content/40 ${isActive && 'text-accent'}`}
                size={18}
              />
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-base-300 bg-base-200 relative sticky top-0 z-10 w-full border-b pt-2 pb-1">
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
