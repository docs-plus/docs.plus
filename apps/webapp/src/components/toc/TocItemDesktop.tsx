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
}

function TocItemDesktopComponent({
  item,
  nestedNodes,
  onToggle,
  activeId = null,
  collapsedIds = EMPTY_COLLAPSED
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
    isGhosted && 'is-ghosted',
    isDragging && 'is-dragging'
  )

  return (
    <li ref={sortable.setNodeRef} className={liClassName} data-id={item.id}>
      <TocRow
        headingId={item.id}
        title={item.textContent}
        density="desktop"
        isActive={isActive}
        isFocused={isFocused}
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
              <Tooltip title="Toggle" placement="top">
                <button
                  type="button"
                  className={twMerge(
                    TOC_CLASSES.foldBtn,
                    'inline-flex size-5 shrink-0 items-center justify-center',
                    item.open ? 'opened' : 'closed'
                  )}
                  onClick={handleToggle}
                  aria-label={item.open ? 'Collapse section' : 'Expand section'}>
                  <Icons.chevronRight size={18} className="fill-none stroke-current" aria-hidden />
                </button>
              </Tooltip>
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
              'cursor-pointer fill-none text-base-content/60 transition-colors hover:text-primary'
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
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export const TocItemDesktop = memo(TocItemDesktopComponent)
