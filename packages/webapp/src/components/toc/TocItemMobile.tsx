import Button from '@components/ui/Button'
import { useModal } from '@components/ui/ModalDrawer'
import UnreadBadge from '@components/ui/UnreadBadge'
import { ChatLeft } from '@icons'
import { useChatStore, useFocusedHeadingStore, useStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { useCallback } from 'react'
import { MdKeyboardArrowRight } from 'react-icons/md'
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
      setFocusedHeadingWithLock(item.id)
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
    'group relative rounded !py-2 pr-10',
    isActive && 'active activeTocBorder bg-base-300',
    item.level === 1 && 'ml-3'
  )

  return (
    <li className={liClassName} data-id={item.id}>
      <a className={aClassName} onClick={handleClick} href={`?${item.id}`} data-id={item.id}>
        {/* Fold/Unfold button — matches desktop (in-flow, same size) for tree-line alignment */}
        {hasChildren && (
          <Button
            variant="ghost"
            size="xs"
            shape="square"
            className={twMerge('btnFold size-5 min-w-5 !p-0', item.open ? 'opened' : 'closed')}
            onClick={handleToggle}
            aria-label={item.open ? 'Collapse section' : 'Expand section'}
            startIcon={<MdKeyboardArrowRight size={18} className="text-base-content" />}
          />
        )}

        {/* Heading text */}
        <span className="toc__link wrap-anywhere">{item.textContent}</span>

        {/* Chat button — absolute right, consistent across nesting levels */}
        <button
          className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-full"
          onClick={handleChatClick}
          aria-label={unreadCount > 0 ? `${unreadCount} unread — open chat` : 'Open chat'}>
          {unreadCount > 0 ? (
            <UnreadBadge count={unreadCount} size="sm" variant="error" />
          ) : (
            <ChatLeft
              fill="currentColor"
              className={twMerge('text-base-content/40', isActive && 'text-accent')}
              size={18}
            />
          )}
        </button>
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
