import React, { useRef, useState, useCallback } from 'react'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { MdAccountTree } from 'react-icons/md'

import { useToc, useTocAutoScroll, useTocDrag } from './hooks'
import { buildNestedToc } from './utils'
import { TocHeader } from './TocHeader'
import { TocItem } from './TocItem'
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
  const { activeId, projectedLevel, originalLevel, collapsedIds, descendantCount, dropTarget } =
    state

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
      <div className={className} style={{ scrollbarGutter: 'stable' }}>
        <TocHeader variant="desktop" />
      </div>
    )
  }

  return (
    <div className={className} style={{ scrollbarGutter: 'stable' }} ref={contextMenuRef}>
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
              <TocItem
                key={item.id}
                item={item}
                children={children}
                variant="desktop"
                onToggle={toggleSection}
                draggable
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

              {/* Drag card */}
              <div
                ref={overlayRef}
                className={`toc-drag-card ${descendantCount > 0 ? 'has-children' : ''}`}>
                {descendantCount > 0 && <MdAccountTree className="toc-tree-icon" size={14} />}
                <span className="toc__link wrap-anywhere">{activeItem.textContent}</span>
                {descendantCount > 0 && (
                  <span className="toc-descendant-badge">+{descendantCount}</span>
                )}
                {descendantCount > 0 && (
                  <>
                    <div className="toc-stack-card toc-stack-card--back" />
                    <div className="toc-stack-card toc-stack-card--mid" />
                  </>
                )}
              </div>
            </div>
          )}
        </DragOverlay>

        {activeId && dropTarget.id && dropTarget.position && dropTarget.rect && (
          <DropIndicatorPortal
            targetRect={dropTarget.rect}
            position={dropTarget.position}
            indentLevel={dropTarget.level - 1}
          />
        )}
      </DndContext>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export default React.memo(TocDesktop)
