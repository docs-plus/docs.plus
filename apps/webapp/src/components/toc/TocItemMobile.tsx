import Button from '@components/ui/Button'
import { useModal } from '@components/ui/ModalDrawer'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore, useStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { useActiveHeading, useTocActions, useUnreadCount } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocRow } from './TocRow'
import { TocRowTrail } from './TocRowTrail'
import { type NestedTocNode, scrollToHeading } from './utils'

interface TocItemMobileProps {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
  depth?: number
}

export function TocItemMobile({ item, nestedNodes, onToggle, depth = 0 }: TocItemMobileProps) {
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

  return (
    <li className={liClassName} data-id={item.id}>
      <TocRow
        headingId={item.id}
        depth={depth}
        level={item.level}
        title={item.textContent}
        density="mobile"
        isActive={isActive}
        onTitleClick={handleClick}
        titleHref={`?${item.id}`}
        leading={
          hasChildren ? (
            <Button
              variant="ghost"
              size="xs"
              shape="square"
              className={twMerge(
                `${TOC_CLASSES.foldBtn} size-11 min-h-11 min-w-11 !p-0`,
                item.open ? 'opened' : 'closed'
              )}
              onClick={handleToggle}
              aria-label={item.open ? 'Collapse section' : 'Expand section'}
              startIcon={<Icons.chevronRight size={18} className="fill-none stroke-current" />}
            />
          ) : null
        }
        trail={
          <TocRowTrail
            headingId={item.id}
            unreadCount={unreadCount}
            isActive={isActive}
            iconSize={20}
            iconClassName={twMerge(TOC_CLASSES.chatIcon, 'text-base-content/40')}
            onChatClick={handleChatClick}
          />
        }
      />

      {hasChildren && (
        <ul className={TOC_CLASSES.children}>
          {nestedNodes.map(({ item: childItem, nodes: grandNodes }) => (
            <TocItemMobile
              key={childItem.id}
              item={childItem}
              nestedNodes={grandNodes}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
