import Button from '@components/ui/Button'
import { useModal } from '@components/ui/ModalDrawer'
import UnreadBadge from '@components/ui/UnreadBadge'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore, useStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { useActiveHeading, useTocActions, useUnreadCount } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { type NestedTocNode, scrollToHeading } from './utils'

interface TocItemMobileProps {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
}

export function TocItemMobile({ item, nestedNodes, onToggle }: TocItemMobileProps) {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const editor = useStore((state) => state.settings.editor.instance)

  const focusedHeadingId = useFocusedHeadingStore((s) => s.focusedHeadingId)
  const isFocused = focusedHeadingId === item.id

  const [, setActiveHeading] = useActiveHeading()
  const unreadCount = useUnreadCount(item.id)
  const { openChatroom } = useTocActions()
  const modal = useModal()

  const isActive = headingId === item.id
  const hasChildren = nestedNodes.length > 0

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

  const liClassName = twMerge(
    'toc__item relative w-full',
    !item.open && 'closed',
    isFocused && TOC_CLASSES.itemFocused
  )

  const aClassName = twMerge(
    'group relative rounded !py-2 pr-10',
    isActive && `active ${TOC_CLASSES.activeBorder} bg-base-300`,
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
            className={twMerge(
              `${TOC_CLASSES.foldBtn} size-5 min-w-5 !p-0`,
              item.open ? 'opened' : 'closed'
            )}
            onClick={handleToggle}
            aria-label={item.open ? 'Collapse section' : 'Expand section'}
            startIcon={<Icons.chevronRight size={18} className="fill-none stroke-current" />}
          />
        )}

        {/* Heading text */}
        <span className="toc__link wrap-anywhere">{item.textContent}</span>

        {/* Chat button — absolute right, consistent across nesting levels */}
        <button
          type="button"
          className={twMerge(
            TOC_CLASSES.chatTrigger,
            'absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-full'
          )}
          data-heading-id={item.id}
          onClick={handleChatClick}
          aria-label={unreadCount > 0 ? `${unreadCount} unread — open chat` : 'Open chat'}>
          {unreadCount > 0 ? (
            <UnreadBadge count={unreadCount} size="sm" variant="error" />
          ) : (
            <Icons.chatroom
              className={twMerge('text-base-content/40', isActive && 'text-accent')}
              size={20}
            />
          )}
        </button>
      </a>

      {/* Nested children */}
      {hasChildren && (
        <ul className={TOC_CLASSES.children}>
          {nestedNodes.map(({ item: childItem, nodes: grandNodes }) => (
            <TocItemMobile
              key={childItem.id}
              item={childItem}
              nestedNodes={grandNodes}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
