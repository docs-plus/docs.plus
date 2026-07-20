import Button from '@components/ui/Button'
import { Tooltip } from '@components/ui/Tooltip'
import { useSortable } from '@dnd-kit/sortable'
import { usePresentUsers } from '@hooks/usePresentUsers'
import { useUnreadCount } from '@hooks/useUnreadCount'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { memo, useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { tocActions } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocLevelPicker } from './TocLevelPicker'
import { TocRow } from './TocRow'
import { TocRowTrail } from './TocRowTrail'
import type { NestedTocNode } from './utils'

const EMPTY_COLLAPSED = new Set<string>()

interface TocItemDesktopProps {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
  activeId?: string | null
  collapsedIds?: Set<string>
  depth?: number
}

function TocItemDesktopComponent({
  item,
  nestedNodes,
  onToggle,
  activeId = null,
  collapsedIds = EMPTY_COLLAPSED,
  depth = 0
}: TocItemDesktopProps) {
  const sortable = useSortable({
    id: item.id,
    disabled: collapsedIds.has(item.id)
  })

  // Boolean selectors — only old/new focused or active rows re-render on spy/chat switch.
  const isFocused = useFocusedHeadingStore((s) => s.focusedHeadingId === item.id)
  const isActive = useChatStore((state) => state.chatRoom.headingId === item.id)

  const presentUsers = usePresentUsers(item.id)
  const unreadCount = useUnreadCount(item.id)

  const hasChildren = nestedNodes.length > 0

  const isDragging = sortable.isDragging
  const isDescendantOfDragged = activeId ? collapsedIds.has(item.id) : false
  const isGhosted = isDragging || isDescendantOfDragged

  const [isHoveringHandle, setIsHoveringHandle] = useState(false)

  const setFocusedHeadingWithLock = useFocusedHeadingStore((s) => s.setFocusedHeadingWithLock)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setFocusedHeadingWithLock(item.id)
      tocActions.navigateToHeading(item.id, { openChat: true })
    },
    [item.id, setFocusedHeadingWithLock]
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
      tocActions.openChatroom(item.id, { focusEditor: true })
    },
    [item.id]
  )

  const liClassName = twMerge(
    'toc__item relative w-full',
    !item.open && 'closed',
    isFocused && TOC_CLASSES.itemFocused,
    isGhosted && 'is-ghosted',
    isDragging && 'is-dragging'
  )

  return (
    <li ref={sortable.setNodeRef} className={liClassName} data-id={item.id}>
      <TocRow
        headingId={item.id}
        depth={depth}
        level={item.level}
        title={item.textContent}
        density="desktop"
        isActive={isActive}
        onTitleClick={handleClick}
        titleHref={`?${item.id}`}
        leading={
          <>
            <span className={TOC_CLASSES.levelBadge}>H{item.level}</span>
            <span className="relative flex shrink-0 items-center self-stretch">
              <Tooltip title="Drag to reorder" placement="top">
                <button
                  type="button"
                  className="toc-drag-handle"
                  aria-label="Drag to reorder"
                  {...sortable.attributes}
                  {...sortable.listeners}
                  onMouseEnter={() => setIsHoveringHandle(true)}
                  onMouseLeave={() => setIsHoveringHandle(false)}
                  onClick={(e) => e.preventDefault()}>
                  <Icons.gripVertical size={16} aria-hidden className="stroke-[1.75]" />
                </button>
              </Tooltip>
              {isHoveringHandle && !isDragging && (
                <TocLevelPicker level={item.level} mode="preview" />
              )}
            </span>
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
                startIcon={<Icons.chevronRight size={18} className="fill-none stroke-current" />}
                tooltip="Toggle"
                tooltipPlacement="top"
              />
            )}
          </>
        }
        trail={
          <TocRowTrail
            headingId={item.id}
            unreadCount={unreadCount}
            presentUsers={presentUsers}
            isActive={isActive}
            iconSize={20}
            tooltipPlacement="left"
            iconClassName={twMerge(
              TOC_CLASSES.chatIcon,
              'cursor-pointer fill-none transition-colors',
              !isActive && 'text-base-content/40 group-hover:text-primary hover:text-primary'
            )}
            onChatClick={handleChatClick}
          />
        }
      />

      {hasChildren && (
        <ul className={TOC_CLASSES.children}>
          {nestedNodes.map(({ item: childItem, nodes: grandNodes }) => (
            <TocItemDesktop
              key={childItem.id}
              item={childItem}
              nestedNodes={grandNodes}
              onToggle={onToggle}
              activeId={activeId}
              collapsedIds={collapsedIds}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export const TocItemDesktop = memo(TocItemDesktopComponent)
