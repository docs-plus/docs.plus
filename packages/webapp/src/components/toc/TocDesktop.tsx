import React, { useRef, useState, useCallback } from 'react'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { MdAccountTree } from 'react-icons/md'

import { useToc, useTocAutoScroll, useTocDrag } from './hooks'
import { buildNestedToc } from './utils'
import { TocHeader } from './TocHeader'
import { TocItemDesktop } from './TocItemDesktop'
import { TocContextMenu } from './TocContextMenu'
import { ContextMenu } from '@components/ui/ContextMenu'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { tocDragModifier, pointerYCollision, DropIndicatorPortal } from './dnd'

interface TocDesktopProps {
  className?: string
}

function removeContextMenuActiveClass() {
  document.querySelectorAll('.toc__item a.context-menu-active').forEach((item) => {
    item.classList.remove('context-menu-active')
  })
}

export function TocDesktop({ className = '' }: TocDesktopProps) {
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
    tocItem.querySelector(`a[data-id="${tocId}"]`)?.classList.add('context-menu-active')

    return tocItem
  }, [])

  const handleContextMenuClose = useCallback(() => {
    setContextMenuState({ headingId: null, isOpen: false })
    removeContextMenuActiveClass()
  }, [])

  const nestedItems = buildNestedToc(items)

  if (!items.length) {
    return (
      <div className={`${className}`}>
        <TocHeader variant="desktop" />
      </div>
    )
  }

  return (
    <div className={`${className}`} ref={contextMenuRef}>
      <TocHeader variant="desktop" />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerYCollision}
        modifiers={[tocDragModifier]}
        {...handlers}>
        <SortableContext items={flatItems.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ul className={`toc__list menu w-full p-0 ${activeId ? 'is-dragging' : ''}`}>
            <ContextMenu
              className="menu bg-base-100 absolute z-20 m-0 rounded-md p-2 shadow-md outline-none"
              parrentRef={contextMenuRef}
              onBeforeShow={handleBeforeShow}
              onClose={handleContextMenuClose}>
              <TocContextMenu
                headingId={contextMenuState.headingId}
                isOpen={contextMenuState.isOpen}
                onToggle={toggleSection}
              />
            </ContextMenu>
            {nestedItems.map(({ item, children }) => (
              <TocItemDesktop
                key={item.id}
                item={item}
                childItems={children}
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
              {/* Level picker */}
              <div className="toc-drag-levels">
                {Array.from({ length: 7 }, (_, i) => i + 1)
                  .filter(
                    (level) =>
                      level >= Math.max(1, originalLevel - 3) &&
                      level <= Math.min(10, originalLevel + 3)
                  )
                  .map((level) => (
                    <span
                      key={level}
                      className={`toc-drag-level ${level === projectedLevel ? 'active' : ''} ${level === originalLevel ? 'original' : ''}`}>
                      H{level}
                    </span>
                  ))}
              </div>

              {/* Drag card - matches source element size */}
              <div
                ref={overlayRef}
                className="toc-drag-card"
                style={
                  sourceRect
                    ? { width: sourceRect.width, minHeight: sourceRect.height, height: 'auto' }
                    : undefined
                }>
                {descendantCount > 0 && <MdAccountTree className="toc-tree-icon" size={14} />}
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

export default React.memo(TocDesktop)
