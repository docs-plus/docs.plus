import { useModal } from '@components/ui/ModalDrawer'
import { usePresentUsers } from '@hooks/usePresentUsers'
import { useUnreadCount } from '@hooks/useUnreadCount'
import { useChatStore, useStore } from '@stores'
import { twMerge } from 'tailwind-merge'

import { chatTriggerAriaLabel, ChatTriggerContent } from './ChatTriggerContent'
import { tocActions } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocRow } from './TocRow'
import { TocRowTrail } from './TocRowTrail'

interface TocHeaderProps {
  variant: 'desktop' | 'mobile'
}

export function TocHeader({ variant }: TocHeaderProps) {
  const docMetadata = useStore((state) => state.settings.metadata)
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const unreadCount = useUnreadCount(workspaceId || '')
  // Mobile header has no presence trail — empty channelId keeps EMPTY + equality bail-out.
  const presentUsers = usePresentUsers(variant === 'desktop' ? workspaceId || '' : '')
  const modal = useModal()
  const closeModal = variant === 'mobile' ? modal?.close : undefined

  const isActive = useChatStore((state) => state.chatRoom.headingId === workspaceId)

  const handleClick = () => {
    tocActions.navigateToDocTitle({ openChat: true })
    if (variant === 'mobile') {
      closeModal?.()
    }
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (workspaceId) {
      tocActions.openChatroom(workspaceId)
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
                'text-base-content/60',
                isActive && TOC_CLASSES.chatIconActive
              )}
            />
          </button>
        </div>
      </div>
    )
  }

  // Desktop: same menu shell as heading rows (`li.toc__header` > TocRow).
  return (
    <TocRow
      headingId={workspaceId || 'doc-title'}
      title={docMetadata?.title ?? ''}
      isActive={isActive}
      className={`${TOC_CLASSES.headerRow} cursor-pointer`}
      titleClassName="text-base font-semibold"
      titleHref="#"
      onTitleClick={(e) => {
        e.preventDefault()
        handleClick()
      }}
      trail={
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
      }
    />
  )
}
