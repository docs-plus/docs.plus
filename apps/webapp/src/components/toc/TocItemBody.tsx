import { useModal } from '@components/ui/ModalDrawer'
import { Tooltip } from '@components/ui/Tooltip'
import { useSortable } from '@dnd-kit/sortable'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { memo, type MouseEvent, type ReactNode, useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { tocActions } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocLevelPicker } from './TocLevelPicker'
import { TocRow } from './TocRow'
import { TocRowTrail } from './TocRowTrail'
import type { NestedTocNode } from './utils'

export type TocItemBodySortable = Pick<
  ReturnType<typeof useSortable>,
  'setNodeRef' | 'attributes' | 'listeners' | 'isDragging'
>

type TocItemBodyProps = {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
  variant: 'desktop' | 'mobile'
  /** Desktop drag adapter — omitted on mobile (no SortableContext). */
  sortable?: TocItemBodySortable
  activeId?: string | null
  collapsedIds?: Set<string>
  /** Desktop only — recurse through the sortable shell. Mobile recurses here. */
  renderChild?: (node: NestedTocNode<TocItemType>) => ReactNode
}

function TocItemBodyComponent({
  item,
  nestedNodes,
  onToggle,
  variant,
  sortable,
  activeId = null,
  collapsedIds,
  renderChild
}: TocItemBodyProps) {
  const isDesktop = variant === 'desktop'
  const isFocused = useFocusedHeadingStore((s) => s.focusedHeadingId === item.id)
  const isActive = useChatStore((state) => state.chatRoom.headingId === item.id)
  const modal = useModal()
  const setFocusedHeadingWithLock = useFocusedHeadingStore((s) => s.setFocusedHeadingWithLock)

  const hasChildren = nestedNodes.length > 0
  const isDragging = Boolean(sortable?.isDragging)
  const isGhosted =
    isDesktop && (isDragging || (activeId && collapsedIds ? collapsedIds.has(item.id) : false))
  const [isHoveringHandle, setIsHoveringHandle] = useState(false)

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      setFocusedHeadingWithLock(item.id)
      tocActions.navigateToHeading(item.id, { openChat: isDesktop })
      if (!isDesktop) modal?.close?.()
    },
    [item.id, setFocusedHeadingWithLock, isDesktop, modal]
  )

  const handleToggle = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onToggle(item.id)
    },
    [item.id, onToggle]
  )

  const handleChatClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      tocActions.openChatroom(item.id, { focusEditor: isDesktop })
      if (!isDesktop) modal?.close?.()
    },
    [item.id, isDesktop, modal]
  )

  const liClassName = twMerge(
    'toc__item relative w-full',
    !item.open && 'closed',
    isGhosted && 'is-ghosted',
    isDragging && 'is-dragging'
  )

  const leading =
    isDesktop && sortable ? (
      <>
        <span className={TOC_CLASSES.levelBadge}>H{item.level}</span>
        <span className="relative flex shrink-0 items-center self-stretch">
          <Tooltip title="Drag to reorder" placement="bottom">
            <button
              type="button"
              className={TOC_CLASSES.dragHandle}
              aria-label="Drag to reorder"
              {...sortable.attributes}
              {...sortable.listeners}
              onMouseEnter={() => setIsHoveringHandle(true)}
              onMouseLeave={() => setIsHoveringHandle(false)}
              onClick={(e) => e.preventDefault()}>
              <Icons.gripVertical size={16} aria-hidden className="stroke-[1.75]" />
            </button>
          </Tooltip>
          {isHoveringHandle && !isDragging && <TocLevelPicker level={item.level} mode="preview" />}
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
    ) : hasChildren ? (
      <button
        type="button"
        className={twMerge(
          TOC_CLASSES.foldBtn,
          'inline-flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center',
          item.open ? 'opened' : 'closed'
        )}
        onClick={handleToggle}
        aria-label={item.open ? 'Collapse section' : 'Expand section'}>
        <Icons.chevronRight size={18} className="fill-none stroke-current" aria-hidden />
      </button>
    ) : null

  return (
    <li ref={sortable?.setNodeRef} className={liClassName} data-id={item.id}>
      <TocRow
        headingId={item.id}
        title={item.textContent}
        density={variant}
        isActive={isActive}
        isFocused={isFocused}
        onTitleClick={handleClick}
        titleHref={`?${item.id}`}
        leading={leading}
        trail={
          <TocRowTrail
            headingId={item.id}
            isActive={isActive}
            showPresence={isDesktop}
            iconSize={20}
            tooltipPlacement={isDesktop ? 'left' : 'top'}
            iconClassName={twMerge(TOC_CLASSES.chatIcon, isDesktop && 'cursor-pointer fill-none')}
            onChatClick={handleChatClick}
          />
        }
      />

      {hasChildren && (
        <ul className={TOC_CLASSES.children}>
          {nestedNodes.map((node) =>
            isDesktop && renderChild ? (
              renderChild(node)
            ) : (
              <TocItemBody
                key={node.item.id}
                item={node.item}
                nestedNodes={node.nodes}
                onToggle={onToggle}
                variant="mobile"
              />
            )
          )}
        </ul>
      )}
    </li>
  )
}

export const TocItemBody = memo(TocItemBodyComponent)
