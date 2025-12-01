import React from 'react'
import { CaretRight, ChatLeft } from '@icons'
import { useChatStore, useStore } from '@stores'
import AvatarStack from '@components/AvatarStack'
import usePresentUsers from '../hooks/usePresentUsers'
import useUnreadMessage from '../hooks/useUnreadMessage'
import useOpenChatContainer from '../hooks/useOpenChatContainer'
import type { TocAnchor } from '../hooks/useTocItems'
import { toggleHeadingSection, scrollToHeading } from '../utils'

type TocItemProps = {
  item: TocAnchor
  children: TocAnchor[]
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export const TocItem = ({ item, children, variant, onNavigate }: TocItemProps) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const presentUsers = usePresentUsers(item.id)
  const unreadCount = useUnreadMessage({ id: item.id })
  const openChatContainer = useOpenChatContainer()

  const isScrollActive = item.isActive // Native TipTap extension
  const isChatActive = headingId === item.id
  const isMobile = variant === 'mobile'

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!editor) return

    scrollToHeading(editor, item.id)
    onNavigate?.()

    if (!isMobile) {
      openChatContainer(item)
    }
  }

  const handleFoldClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    toggleHeadingSection(item.id)
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    openChatContainer(item, isMobile ? { focusEditor: false } : undefined)
    onNavigate?.()
  }

  return (
    <li
      className={`toc__item relative w-full ${item.open ? '' : 'closed'} ${isScrollActive ? 'focusSight' : ''}`}
      data-id={item.id}>
      <a
        className={`group relative ${isMobile ? '!py-2' : ''} ${isChatActive ? 'activeTocBorder bg-gray-300' : ''} ${isScrollActive ? 'font-semibold text-blue-600' : ''}`}
        onClick={handleClick}
        href={`?${item.id}`}
        data-id={item.id}>
        <span
          className={`btnFold ${item.open ? 'opened' : 'closed'}`}
          onClick={handleFoldClick}
          data-tip="Toggle">
          <CaretRight size={17} fill="#363636" />
        </span>

        <span className="toc__link wrap-anywhere">{item.textContent}</span>

        {isMobile && <span className="block w-8 pl-8" />}

        {isMobile ? (
          <span
            className="btn_openChatBox bg-neutral text-neutral-content flex items-center justify-end overflow-hidden"
            onClick={handleChatClick}
            data-unread-count={unreadCount > 0 ? unreadCount : ''}>
            <ChatLeft
              className={`chatLeft fill-neutral-content ${isChatActive && '!fill-accent'}`}
              size={14}
            />
          </span>
        ) : (
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
        )}

        {!isMobile && presentUsers.length > 0 && (
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

      {children.length > 0 && (
        <ul className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>
          <TocList items={children} variant={variant} onNavigate={onNavigate} />
        </ul>
      )}
    </li>
  )
}

type TocListProps = {
  items: TocAnchor[]
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export const TocList = ({ items, variant, onNavigate }: TocListProps) => {
  const renderedItems: React.ReactNode[] = []

  for (let i = 0; i < items.length; ) {
    const item = items[i]
    const children: TocAnchor[] = []
    let j = i + 1

    while (j < items.length && items[j].level > item.level) {
      children.push(items[j])
      j++
    }

    renderedItems.push(
      <TocItem
        key={item.id}
        item={item}
        children={children}
        variant={variant}
        onNavigate={onNavigate}
      />
    )
    i = j
  }

  return <>{renderedItems}</>
}
