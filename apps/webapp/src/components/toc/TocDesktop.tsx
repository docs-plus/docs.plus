import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { ContextMenu } from '@components/ui/ContextMenu'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { selectDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DropIndicatorPortal, noCollisions, restrictToVerticalAxis } from './dnd'
import { useToc, useTocAutoScroll, useTocDrag } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocContextMenu } from './TocContextMenu'
import { TocEmptyState } from './TocEmptyState'
import { TocHeader } from './TocHeader'
import { TocItemDesktop } from './TocItemDesktop'
import { buildNestedToc } from './utils'

interface TocDesktopProps {
  className?: string
}

function removeContextMenuActiveClass() {
  document
    .querySelectorAll(`.toc__item .${TOC_CLASSES.row}.${TOC_CLASSES.contextMenuActive}`)
    .forEach((item) => {
      item.classList.remove(TOC_CLASSES.contextMenuActive)
    })
}

function TocDesktopComponent({ className = '' }: TocDesktopProps) {
  const { items, toggleSection } = useToc()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useTocAutoScroll()

  const profileId = useAuthStore((s) => s.profile?.id)
  const locked = useStore((s) => selectDocumentEditingLocked(s.settings, profileId))
  const { state, activeItem, sensors, handlers } = useTocDrag(items)
  const { activeId, collapsedIds, descendantCount, gap, canDrop, sourceRect } = state

  const [contextMenuState, setContextMenuState] = useState<{
    headingId: string | null
    isOpen: boolean
  }>({
    headingId: null,
    isOpen: false
  })

  const handleBeforeShow = useCallback((target: Element) => {
    const tocItem = target.closest('.toc__item')
    if (!tocItem) return null

    removeContextMenuActiveClass()

    const tocId = tocItem.getAttribute('data-id')
    const isOpen = !tocItem.classList.contains('closed')

    setContextMenuState({ headingId: tocId, isOpen })
    tocItem
      .querySelector(`.${TOC_CLASSES.row}[data-id="${tocId}"]`)
      ?.classList.add(TOC_CLASSES.contextMenuActive)

    return tocItem
  }, [])

  const handleContextMenuClose = useCallback(() => {
    setContextMenuState({ headingId: null, isOpen: false })
    removeContextMenuActiveClass()
  }, [])

  const nestedItems = useMemo(() => buildNestedToc(items), [items])
  const sortableIds = useMemo(() => items.map((i) => i.id), [items])
  const hasItems = items.length > 0

  const headerItem = (
    <li className={TOC_CLASSES.header}>
      <TocHeader variant="desktop" />
    </li>
  )

  if (!hasItems) {
    return (
      <div className={className}>
        <ul className={TOC_CLASSES.listMenu}>{headerItem}</ul>
        <TocEmptyState />
      </div>
    )
  }

  return (
    <div className={className} ref={contextMenuRef}>
      <DndContext
        sensors={sensors}
        collisionDetection={noCollisions}
        modifiers={[restrictToVerticalAxis]}
        {...handlers}>
        <SortableContext items={sortableIds}>
          <ul className={`${TOC_CLASSES.listMenu} ${activeId ? 'is-dragging' : ''}`}>
            {headerItem}
            <ContextMenu
              aria-label="Section options"
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
                locked={locked}
              />
            ))}
          </ul>
        </SortableContext>

        {/* The scroller's fade mask would clip and fade the fixed drag card. */}
        {typeof document !== 'undefined' &&
          createPortal(
            <DragOverlay dropAnimation={null} zIndex={60}>
              {activeItem && (
                <div className="toc-drag-wrapper">
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
                      <div
                        className="toc-stack-indicator"
                        data-count={Math.min(descendantCount, 3)}
                      />
                    )}
                  </div>
                </div>
              )}
            </DragOverlay>,
            document.body
          )}

        {activeId && gap && canDrop && (
          <DropIndicatorPortal
            indicatorY={gap.indicatorY}
            left={gap.rect.left}
            width={gap.rect.width}
          />
        )}
      </DndContext>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export const TocDesktop = React.memo(TocDesktopComponent)
