import { useModal } from '@components/ui/ModalDrawer'
import { useChatStore, useStore } from '@stores'
import { twMerge } from 'tailwind-merge'

import { chatTriggerAriaLabel, ChatTriggerContent } from './ChatTriggerContent'
import { usePresentUsers, useTocActions, useUnreadCount } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocRowTrail } from './TocRowTrail'
import { scrollToDocTitle } from './utils'

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
    // Mobile TocModal: chat trigger only — no TocRowTrail / presence stack (drawer UX).
    return (
      <div className="border-base-300 bg-base-100 isolate z-30 shrink-0 border-b px-4 py-3">
        <div className="group relative flex items-center justify-between gap-3">
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
                isActive && TOC_CLASSES.chatIconActive
              )}
            />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="border-base-300 relative isolate z-30 w-full shrink-0 border-b bg-[var(--pad-well)] pt-2 pb-1"
      style={{ paddingLeft: 'var(--toc-list-inset)' }}>
      <div
        className={twMerge(
          `${TOC_CLASSES.headerRow} group rounded-field relative flex cursor-pointer items-center gap-1 overflow-hidden py-1 pr-3`,
          isActive && `${TOC_CLASSES.activeBorder} bg-base-300`
        )}
        onClick={handleClick}>
        <span className="text-base-content relative z-[1] min-w-0 flex-1 text-base font-semibold">
          {docMetadata?.title}
        </span>
        <TocRowTrail
          headingId={workspaceId || undefined}
          unreadCount={unreadCount}
          presentUsers={presentUsers}
          isActive={isActive}
          iconSize={16}
          maxAvatars={3}
          iconClassName={twMerge(
            TOC_CLASSES.chatIcon,
            'cursor-pointer text-base-content/60 transition-colors hover:text-primary'
          )}
          onChatClick={handleChatClick}
        />
      </div>
    </div>
  )
}
