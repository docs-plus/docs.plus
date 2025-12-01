import React, { useRef, useState } from 'react'
import useTocItems from './hooks/useTocItems'
import { TocList } from './components/TocItem'
import { DocTitleChatRoomDesktop } from './components/DocTitleChatRoom'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { ContextMenu } from '@components/ui/ContextMenu'
import ContextMenuItems from './components/ContextMenuItems'

const removeContextMenuActiveClass = () => {
  document.querySelectorAll('.toc__item a.context-menu-active').forEach((item) => {
    item.classList.remove('context-menu-active')
  })
}

type Props = {
  className?: string
}

const TocDesktop = ({ className }: Props) => {
  const { items } = useTocItems()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [contextMenuState, setContextMenuState] = useState<{ tocItem: Element | null }>({
    tocItem: null
  })

  const handleBeforeShow = (e: any) => {
    const tocItem = e.target.closest('.toc__item')
    if (!tocItem) return null

    setContextMenuState({ tocItem })
    removeContextMenuActiveClass()

    const tocId = tocItem.getAttribute('data-id')
    tocItem.querySelector(`a[data-id="${tocId}"]`)?.classList.add('context-menu-active')

    return tocItem
  }

  const handleContextMenuClose = () => {
    setContextMenuState({ tocItem: null })
    removeContextMenuActiveClass()
  }

  if (!items.length) {
    return (
      <div className={className} style={{ scrollbarGutter: 'stable' }}>
        <DocTitleChatRoomDesktop className="my-1" />
      </div>
    )
  }

  return (
    <div className={className} style={{ scrollbarGutter: 'stable' }} ref={contextMenuRef}>
      <DocTitleChatRoomDesktop className="my-1" />
      <ul className="toc__list menu w-full p-0">
        <ContextMenu
          className="menu bg-base-100 absolute z-20 m-0 rounded-md p-2 shadow-md outline-none"
          parrentRef={contextMenuRef}
          onBeforeShow={handleBeforeShow}
          onClose={handleContextMenuClose}>
          <ContextMenuItems tocItem={contextMenuState?.tocItem} />
        </ContextMenu>
        <TocList items={items} variant="desktop" />
      </ul>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export default React.memo(TocDesktop)
