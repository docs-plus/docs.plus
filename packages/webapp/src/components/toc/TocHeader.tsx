import AvatarStack from '@components/AvatarStack'
import { useModal } from '@components/ui/ModalDrawer'
import { Tooltip } from '@components/ui/Tooltip'
import { useChatStore, useStore } from '@stores'
import { twMerge } from 'tailwind-merge'

import { chatTriggerAriaLabel, ChatTriggerContent } from './ChatTriggerContent'
import { usePresentUsers, useTocActions, useUnreadCount } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { scrollToDocTitle, tocTrailingRailPx } from './utils'

interface TocHeaderProps {
  variant: 'desktop' | 'mobile'
}

export function TocHeader({ variant }: TocHeaderProps) {
  const docMetadata = useStore((state) => state.settings.metadata)
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const headingId = useChatStore((state) => state.chatRoom.headingId)
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
      <div className="border-base-300 bg-base-100 isolate z-30 shrink-0 border-b">
        <div className="group relative flex items-center justify-between py-2">
          <span className="text-base-content text-lg font-bold">{docMetadata?.title}</span>
          <button
            type="button"
            className={`${TOC_CLASSES.chatTrigger} flex size-8 items-center justify-center rounded-full`}
            data-heading-id={workspaceId || undefined}
            onClick={handleChatClick}
            aria-label={chatTriggerAriaLabel(unreadCount)}>
            <ChatTriggerContent
              unreadCount={unreadCount}
              iconSize={18}
              iconClassName={twMerge(
                TOC_CLASSES.chatIcon,
                'text-base-content/40',
                isActive && 'text-accent'
              )}
            />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-base-300 bg-base-200 relative isolate z-30 w-full shrink-0 border-b pt-2 pb-1">
      <div
        className={twMerge(
          `${TOC_CLASSES.headerRow} group relative flex cursor-pointer items-center gap-1 overflow-hidden rounded-md p-1 pr-3 pl-2`,
          isActive && `${TOC_CLASSES.activeBorder} bg-base-300 !pl-4`
        )}
        onClick={handleClick}>
        <span className="text-base-content relative z-[1] min-w-0 flex-1 text-lg font-bold">
          {docMetadata?.title}
        </span>
        <div
          className="relative ml-auto h-8 shrink-0"
          style={{ width: tocTrailingRailPx(presentUsers.length, unreadCount) }}>
          <Tooltip title="Chat Room" placement="top">
            <button
              type="button"
              className={`${TOC_CLASSES.chatTrigger} absolute top-1/2 left-0 z-[3] -translate-y-1/2`}
              data-heading-id={workspaceId || undefined}
              onClick={handleChatClick}
              aria-label={chatTriggerAriaLabel(unreadCount)}>
              <ChatTriggerContent
                unreadCount={unreadCount}
                iconSize={16}
                iconClassName={`${TOC_CLASSES.chatIcon} text-base-content/60 hover:text-primary ml-1 cursor-pointer transition-colors`}
              />
            </button>
          </Tooltip>
          {presentUsers.length > 0 && (
            <div className="absolute top-1/2 right-0 z-[2] -translate-y-1/2">
              <AvatarStack
                maxDisplay={3}
                size="sm"
                users={presentUsers}
                showStatus={true}
                tooltipPosition="left"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
