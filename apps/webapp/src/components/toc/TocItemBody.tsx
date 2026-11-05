import { useModal } from '@components/ui/ModalDrawer'
import { Tooltip } from '@components/ui/Tooltip'
import type { useDraggable } from '@dnd-kit/core'
import { Icons } from '@icons'
import { padUrl } from '@services/padUrl'
import { useChatStore, useFocusedHeadingStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { twMerge } from '@utils/twMerge'
import { memo, type MouseEvent, type ReactNode, useCallback } from 'react'

import { tocActions } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocRow } from './TocRow'
import { TocRowTrail } from './TocRowTrail'
import type { NestedTocNode } from './utils/buildNestedToc'

// No `attributes`: they announce a keyboard pickup, and the TOC has no keyboard drag.
type TocItemBodyDraggable = Pick<
  ReturnType<typeof useDraggable>,
  'setNodeRef' | 'listeners' | 'isDragging'
>

type TocItemBodyProps = {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
  variant: 'desktop' | 'mobile'
  /** Desktop drag adapter — omitted on mobile. */
  draggable?: TocItemBodyDraggable
  /** False for the Title and on a locked pad: the row renders no grip. */
  canDrag?: boolean
  activeId?: string | null
  collapsedIds?: Set<string>
  /** Desktop only — recurse through the drag shell. Mobile recurses here. */
  renderChild?: (node: NestedTocNode<TocItemType>) => ReactNode
}

function TocItemBodyComponent({
  item,
  nestedNodes,
  onToggle,
  variant,
  draggable,
  canDrag = false,
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
  const isDragging = Boolean(draggable?.isDragging)
  const isGhosted =
    isDesktop && (isDragging || (activeId && collapsedIds ? collapsedIds.has(item.id) : false))

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

  const foldSize = isDesktop ? 'size-5' : 'size-11 min-h-11 min-w-11'
  // A desktop leaf has no fold slot, so its title takes the space (ruling update
  // 2026-11-04, #373). A phone leaf keeps its blank 44px slot.
  const fold = hasChildren ? (
    <button
      type="button"
      className={twMerge(
        TOC_CLASSES.foldBtn,
        'inline-flex shrink-0 items-center justify-center',
        foldSize,
        item.open ? 'opened' : 'closed'
      )}
      onClick={handleToggle}
      aria-expanded={item.open}
      aria-label={item.open ? 'Collapse section' : 'Expand section'}>
      <Icons.chevronRight size={18} className="fill-none stroke-current" aria-hidden />
    </button>
  ) : isDesktop ? null : (
    <span aria-hidden="true" className={twMerge('shrink-0', foldSize)} />
  )

  const leading =
    isDesktop && draggable ? (
      <>
        <span className={TOC_CLASSES.levelBadge}>H{item.level}</span>
        {canDrag && (
          <span className="relative flex shrink-0 items-center self-stretch">
            <Tooltip title="Drag to reorder" placement="bottom">
              <button
                type="button"
                className={TOC_CLASSES.dragHandle}
                aria-label="Drag to reorder"
                {...draggable.listeners}
                onClick={(e) => e.preventDefault()}>
                <Icons.gripVertical size={16} aria-hidden className="stroke-[1.75]" />
              </button>
            </Tooltip>
          </span>
        )}
        {hasChildren ? (
          <Tooltip title="Toggle" placement="top">
            {fold}
          </Tooltip>
        ) : (
          fold
        )}
      </>
    ) : (
      fold
    )

  return (
    <li ref={draggable?.setNodeRef} className={liClassName} data-id={item.id}>
      <TocRow
        headingId={item.id}
        title={item.textContent}
        // Same word the editor placeholder shows on an empty heading.
        titleLabel={`Heading ${item.level}`}
        density={variant}
        isActive={isActive}
        isFocused={isFocused}
        onTitleClick={handleClick}
        titleHref={padUrl.link({ kind: 'heading', headingId: item.id })}
        leading={leading}
        trail={
          <TocRowTrail
            headingId={item.id}
            isActive={isActive}
            showPresence={isDesktop}
            tooltipPlacement={isDesktop ? 'left' : 'top'}
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
