import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { ContextMenu, contextMenuPanelClassName } from '@components/ui/ContextMenu'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Icons } from '@icons'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { DropIndicatorPortal, pointerYCollision, tocDragModifier } from './dnd'
import { useToc, useTocAutoScroll, useTocDrag } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocContextMenu } from './TocContextMenu'
import { TocEmptyState } from './TocEmptyState'
import { TocHeader } from './TocHeader'
import { TocItemDesktop } from './TocItemDesktop'
import { TocLevelPicker } from './TocLevelPicker'
import { buildNestedToc } from './utils'

interface TocDesktopProps {
  className?: string
}

function removeContextMenuActiveClass() {
  document
    .querySelectorAll(`.toc__item .${TOC_CLASSES.row}.context-menu-active`)
    .forEach((item) => {
      item.classList.remove('context-menu-active')
    })
}

function TocDesktopComponent({ className = '' }: TocDesktopProps) {
  const { items, toggleSection } = useToc()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useTocAutoScroll()

  const { state, activeItem, flatItems, sensors, handlers } = useTocDrag(items)
  const {
    activeId,
    projectedLevel,
    originalLevel,
    collapsedIds,
    descendantCount,
    dropTarget,
    sourceRect
  } = state

  const [contextMenuState, setContextMenuState] = useState<{
    headingId: string | null
    isOpen: boolean
  }>({
    headingId: null,
    isOpen: false
  })

  const handleBeforeShow = useCallback((e: any) => {
    const tocItem = e.target.closest('.toc__item')
    if (!tocItem) return null

    removeContextMenuActiveClass()

    const tocId = tocItem.getAttribute('data-id')
    const isOpen = !tocItem.classList.contains('closed')

    setContextMenuState({ headingId: tocId, isOpen })
    tocItem
      .querySelector(`.${TOC_CLASSES.row}[data-id="${tocId}"]`)
      ?.classList.add('context-menu-active')

    return tocItem
  }, [])

  const handleContextMenuClose = useCallback(() => {
    setContextMenuState({ headingId: null, isOpen: false })
    removeContextMenuActiveClass()
  }, [])

  const nestedItems = useMemo(() => buildNestedToc(items), [items])
  const sortableIds = useMemo(() => flatItems.map((f) => f.id), [flatItems])
  const hasItems = items.length > 0

  const headerItem = (
    <li className={TOC_CLASSES.header}>
      <TocHeader variant="desktop" />
    </li>
  )

  if (!hasItems) {
    return (
      <div className={className}>
        <ul className="toc__list menu w-full p-0">{headerItem}</ul>
        <TocEmptyState />
      </div>
    )
  }

  return (
    <div className={className} ref={contextMenuRef}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerYCollision}
        modifiers={[tocDragModifier]}
        {...handlers}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <ul className={`toc__list menu w-full p-0 ${activeId ? 'is-dragging' : ''}`}>
            {headerItem}
            <ContextMenu
              className={twMerge(contextMenuPanelClassName, 'absolute z-40')}
              parentRef={contextMenuRef}
              onBeforeShow={handleBeforeShow}
              onClose={handleContextMenuClose}>
              <TocContextMenu
                headingId={contextMenuState.headingId}
                isOpen={contextMenuState.isOpen}
                onToggle={toggleSection}
              />
            </ContextMenu>
            {nestedItems.map(({ item, nodes }) => (
              <TocItemDesktop
                key={item.id}
                item={item}
                nestedNodes={nodes}
                onToggle={toggleSection}
                activeId={activeId}
                collapsedIds={collapsedIds}
              />
            ))}
          </ul>
        </SortableContext>

        <DragOverlay dropAnimation={null} style={{ zIndex: 10000 }}>
          {activeItem && (
            <div className="toc-drag-wrapper">
              <TocLevelPicker level={originalLevel} projectedLevel={projectedLevel} />

              {/* Drag card - matches source element size */}
              <div
                ref={overlayRef}
                className="toc-drag-card"
                style={
                  sourceRect
                    ? { width: sourceRect.width, minHeight: sourceRect.height, height: 'auto' }
                    : undefined
                }>
                {descendantCount > 0 && <Icons.listTree className="toc-tree-icon" size={14} />}
                <span className="toc__link wrap-anywhere">{activeItem.textContent}</span>
                {descendantCount > 0 && (
                  <span className="toc-descendant-badge">+{descendantCount}</span>
                )}
                {descendantCount > 0 && (
                  <div className="toc-stack-indicator" data-count={Math.min(descendantCount, 3)} />
                )}
              </div>
            </div>
          )}
        </DragOverlay>

        {activeId && dropTarget.id && dropTarget.indicatorY !== null && dropTarget.rect && (
          <DropIndicatorPortal
            indicatorY={dropTarget.indicatorY}
            left={dropTarget.rect.left}
            width={dropTarget.rect.width}
          />
        )}
      </DndContext>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export const TocDesktop = React.memo(TocDesktopComponent)
