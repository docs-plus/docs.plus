import { useModal } from '@components/ui/ModalDrawer'
import { useChatStore, useStore } from '@stores'
import { twMerge } from 'tailwind-merge'

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

  const trail = workspaceId ? (
    <TocRowTrail
      headingId={workspaceId}
      isActive={isActive}
      showPresence={variant === 'desktop'}
      iconSize={variant === 'desktop' ? 16 : 18}
      maxAvatars={3}
      triggerClassName={variant === 'mobile' ? 'size-8 rounded-full' : undefined}
      iconClassName={twMerge(
        TOC_CLASSES.chatIcon,
        variant === 'desktop'
          ? 'cursor-pointer text-base-content/60 transition-colors hover:text-primary'
          : 'text-base-content/60'
      )}
      onChatClick={handleChatClick}
    />
  ) : null

  if (variant === 'mobile') {
    return (
      <div className="border-base-300 bg-base-100 isolate z-30 shrink-0 border-b px-4 py-3">
        <div className="group relative flex items-center justify-between gap-3">
          <span className="text-base-content text-lg font-bold">{docMetadata?.title}</span>
          {trail}
        </div>
      </div>
    )
  }

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
      trail={trail}
    />
  )
}
