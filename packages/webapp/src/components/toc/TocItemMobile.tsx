import { useModal } from '@components/ui/ModalDrawer'
import { CaretRight, ChatLeft } from '@icons'
import { useChatStore, useFocusedHeadingStore, useStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { useActiveHeading, useTocActions, useUnreadCount } from './hooks'
import { buildNestedToc, scrollToHeading } from './utils'

interface TocItemMobileProps {
  item: TocItemType
  childItems: TocItemType[]
  onToggle: (id: string) => void
}

export function TocItemMobile({ item, childItems, onToggle }: TocItemMobileProps) {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const focusedHeadingId = useFocusedHeadingStore((s) => s.focusedHeadingId)
  const isFocused = focusedHeadingId === item.id

  const [, setActiveHeading] = useActiveHeading()
  const unreadCount = useUnreadCount(item.id)
  const { openChatroom } = useTocActions()
  const modal = useModal()

  const isActive = headingId === item.id
  const hasChildren = childItems.length > 0

  const setFocusedHeadingWithLock = useFocusedHeadingStore((s) => s.setFocusedHeadingWithLock)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!editor) return

      setActiveHeading(item.id)
      setFocusedHeadingWithLock(item.id) // Lock focus during smooth scroll
      scrollToHeading(editor, item.id, { openChatRoom: false })
      modal?.close?.()
    },
    [editor, item.id, setActiveHeading, setFocusedHeadingWithLock, modal]
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
      openChatroom(item.id, { focusEditor: false })
      modal?.close?.()
    },
    [item.id, openChatroom, modal]
  )

  if (!editor) return null

  const nestedChildren = buildNestedToc(childItems)

  const liClassName = twMerge(
    'toc__item relative w-full',
    !item.open && 'closed',
    isFocused && 'focusSight'
  )

  const aClassName = twMerge(
    'group relative rounded !py-2',
    isActive && 'active activeTocBorder bg-gray-300',
    item.level === 1 && 'ml-3'
  )

  return (
    <li className={liClassName} data-id={item.id}>
      <a className={aClassName} onClick={handleClick} href={`?${item.id}`} data-id={item.id}>
        {/* Fold/Unfold button - only show if has children */}
        {hasChildren && (
          <span
            className={twMerge('btnFold tooltip tooltip-top', item.open ? 'opened' : 'closed')}
            onClick={handleToggle}
            data-tip="Toggle">
            <CaretRight size={17} fill="#363636" />
          </span>
        )}

        {/* Heading text */}
        <span className="toc__link wrap-anywhere">{item.textContent}</span>

        {/* Chat button */}
        <span className="block w-8 pl-8" />
        <span
          className="btn_openChatBox bg-neutral text-neutral-content flex items-center justify-end overflow-hidden"
          onClick={handleChatClick}
          data-unread-count={unreadCount > 0 ? unreadCount : ''}>
          <ChatLeft
            className={twMerge('chatLeft fill-neutral-content', isActive && '!fill-accent')}
            size={14}
          />
        </span>
      </a>

      {/* Nested children */}
      {hasChildren && (
        <ul className={twMerge('childrenWrapper', !item.open && 'hidden')}>
          {nestedChildren.map(({ item: childItem, children: grandChildren }) => (
            <TocItemMobile
              key={childItem.id}
              item={childItem}
              childItems={grandChildren}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
