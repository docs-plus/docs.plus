import { useCallback } from 'react'
import { CaretRight, ChatLeft } from '@icons'
import { useStore, useChatStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { useTocActions, usePresentUsers, useUnreadCount, useActiveHeading } from './hooks'
import { scrollToHeading, buildNestedToc } from './utils'
import { useModal } from '@components/ui/ModalDrawer'
import AvatarStack from '@components/AvatarStack'

interface TocItemProps {
  item: TocItemType
  children: TocItemType[]
  variant: 'desktop' | 'mobile'
  onToggle: (id: string) => void
}

export function TocItem({ item, children, variant, onToggle }: TocItemProps) {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const presentUsers = usePresentUsers(item.id)
  const [, setActiveHeading] = useActiveHeading()
  const unreadCount = useUnreadCount(item.id)
  const { openChatroom } = useTocActions()
  const { close: closeModal } = variant === 'mobile' ? useModal() || {} : {}

  const isActive = headingId === item.id
  const hasChildren = children.length > 0

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!editor) return

      setActiveHeading(item.id)
      scrollToHeading(editor, item.id, { openChatRoom: variant === 'desktop' })

      if (variant === 'mobile') {
        closeModal?.()
      }
    },
    [editor, item.id, variant, setActiveHeading, closeModal]
  )

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onToggle(item.id)
    },
    [item.id, onToggle]
  )

  const handleChatClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      openChatroom(item.id, { focusEditor: variant === 'desktop' })
      if (variant === 'mobile') {
        closeModal?.()
      }
    },
    [item.id, variant, openChatroom, closeModal]
  )

  if (!editor) return null

  const nestedChildren = buildNestedToc(children)

  return (
    <li
      className={`toc__item relative w-full ${!item.open ? 'closed' : ''}`}
      data-id={item.id}
      data-offsettop={item.offsetTop}>
      <a
        className={`group relative ${isActive ? 'active activeTocBorder bg-gray-300' : ''} ${variant === 'mobile' ? '!py-2' : ''} ${variant === 'mobile' && item.level === 1 ? 'ml-3' : ''}`}
        onClick={handleClick}
        href={`?${item.id}`}
        data-id={item.id}>
        {/* Fold/Unfold button */}
        <span
          className={`btnFold tooltip tooltip-top ${item.open ? 'opened' : 'closed'}`}
          onClick={handleToggle}
          data-tip="Toggle">
          <CaretRight size={17} fill="#363636" />
        </span>

        {/* Heading text */}
        <span className="toc__link wrap-anywhere">{item.textContent}</span>

        {/* Chat button */}
        {variant === 'desktop' ? (
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
              className={`btnChat ${unreadCount > 0 && 'hidden'} group-hover:fill-docsy cursor-pointer transition-all hover:fill-indigo-900`}
              size={18}
            />
          </span>
        ) : (
          <>
            <span className="block w-8 pl-8" />
            <span
              className="btn_openChatBox bg-neutral text-neutral-content flex items-center justify-end overflow-hidden"
              onClick={handleChatClick}
              data-unread-count={unreadCount > 0 ? unreadCount : ''}>
              <ChatLeft
                className={`chatLeft fill-neutral-content ${isActive && '!fill-accent'}`}
                size={14}
              />
            </span>
          </>
        )}

        {/* Present users (desktop only) */}
        {variant === 'desktop' && presentUsers.length > 0 && (
          <div className="absolute -right-5">
            <AvatarStack
              size={8}
              users={presentUsers}
              showStatus={true}
              tooltipPosition="tooltip-left"
            />
          </div>
        )}
      </a>

      {/* Nested children */}
      {hasChildren && (
        <ul className={`childrenWrapper ${!item.open ? 'hidden' : ''}`}>
          {nestedChildren.map(({ item: childItem, children: grandChildren }) => (
            <TocItem
              key={childItem.id}
              item={childItem}
              children={grandChildren}
              variant={variant}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

