import React, { useRef, useState, useCallback } from 'react'
import { useToc, useTocAutoScroll } from './hooks'
import { buildNestedToc } from './utils'
import { TocHeader } from './TocHeader'
import { TocItem } from './TocItem'
import { TocContextMenu } from './TocContextMenu'
import { ContextMenu } from '@components/ui/ContextMenu'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'

interface TocDesktopProps {
  className?: string
}

function removeContextMenuActiveClass() {
  const tocItems = document.querySelectorAll('.toc__item a.context-menu-active')
  tocItems.forEach((item) => {
    item.classList.remove('context-menu-active')
  })
}

export function TocDesktop({ className = '' }: TocDesktopProps) {
  const { items, toggleSection } = useToc()
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Auto-scroll TOC when focused heading changes
  useTocAutoScroll()
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

    // Highlight the toc item
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
      <ul className="toc__list menu w-full p-0">
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
          />
        ))}
      </ul>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export default React.memo(TocDesktop)
