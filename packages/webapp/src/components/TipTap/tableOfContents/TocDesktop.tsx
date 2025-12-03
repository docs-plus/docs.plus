import React, { memo, useRef, useState, useCallback } from 'react'
import { ContextMenu } from '@components/ui/ContextMenu'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { DocTitle, TocList, TocContextMenu } from './components'
import { useTocItems } from './hooks'

interface TocDesktopProps {
  className?: string
}

const TocDesktop = memo(({ className = '' }: TocDesktopProps) => {
  const items = useTocItems()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [contextTarget, setContextTarget] = useState<Element | null>(null)

  const handleBeforeContextMenu = useCallback((e: any) => {
    const tocItem = e.target.closest('.toc__item') as Element | null
    if (!tocItem) return null

    // Remove any existing highlight
    document.querySelectorAll('.toc__item a.context-menu-active').forEach((el) => {
      el.classList.remove('context-menu-active')
    })

    // Highlight current item
    const tocId = tocItem.getAttribute('data-id')
    tocItem.querySelector(`a[data-id="${tocId}"]`)?.classList.add('context-menu-active')

    setContextTarget(tocItem)
    return tocItem
  }, [])

  const handleContextMenuClose = useCallback(() => {
    setContextTarget(null)
    document.querySelectorAll('.toc__item a.context-menu-active').forEach((el) => {
      el.classList.remove('context-menu-active')
    })
  }, [])

  // Empty state
  if (!items.length) {
    return (
      <div className={className} style={{ scrollbarGutter: 'stable' }}>
        <DocTitle className="my-1" variant="desktop" />
      </div>
    )
  }

  return (
    <div className={className} style={{ scrollbarGutter: 'stable' }} ref={contextMenuRef}>
      <DocTitle className="my-1" variant="desktop" />

      <ul className="toc__list menu w-full p-0">
        <ContextMenu
          className="menu bg-base-100 absolute z-20 m-0 rounded-md p-2 shadow-md outline-none"
          parrentRef={contextMenuRef}
          onBeforeShow={handleBeforeContextMenu}
          onClose={handleContextMenuClose}>
          <TocContextMenu tocElement={contextTarget} />
        </ContextMenu>

        <TocList items={items} variant="desktop" />
      </ul>

      <AppendHeadingButton className="mt-4" />
    </div>
  )
})

TocDesktop.displayName = 'TocDesktop'

export default TocDesktop
