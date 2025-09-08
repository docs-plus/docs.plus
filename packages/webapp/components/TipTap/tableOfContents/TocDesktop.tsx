import React, { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@stores'
import useHandelTocUpdate from './hooks/useHandelTocUpdate'
import { RenderTocs } from './RenderTocs'
import { DocTitleChatRoomDesktop } from './components/DocTitleChatRoom'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { ContextMenu } from '@components/ui/ContextMenu'
import ContextMenuItems from './components/ContextMenuItems'

const removeContextMenuActiveClass = () => {
  const tocItems = document.querySelectorAll('.toc__item a.context-menu-active')
  tocItems.forEach((item: Element) => {
    item.classList.remove('context-menu-active')
  })
}

const TOCDesktop = ({ className }: any) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const [renderedTocs, setRenderedTocs] = useState([])
  const { items } = useHandelTocUpdate()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [contextMenuState, setContextMenuState] = useState<{
    tocItem: Element | null
  }>({
    tocItem: null
  })

  useEffect(() => {
    if (!items.length) return
    const tocs = RenderTocs(items)
    // @ts-ignore
    setRenderedTocs(tocs)
  }, [items, headingId])

  const handleBeforeShow = (e: any) => {
    const tocItem = e.target.closest('.toc__item') ?? null
    if (!tocItem) return null
    setContextMenuState({ tocItem })

    removeContextMenuActiveClass()

    const tocId = tocItem.getAttribute('data-id')

    // Add CSS class to highlight the toc item
    tocItem.querySelector(`a[data-id="${tocId}"]`)?.classList.add('context-menu-active')

    return tocItem
  }
  const handleContextMenuClose = () => {
    setContextMenuState({
      tocItem: null
    })
    // Remove CSS class from the toc item
    // find all .toc__item and the remove the class
    removeContextMenuActiveClass()
  }
  if (!items.length)
    return (
      <div className={`${className}`} style={{ scrollbarGutter: 'stable' }}>
        <DocTitleChatRoomDesktop className="my-1" />
      </div>
    )

  return (
    <div className={`${className}`} style={{ scrollbarGutter: 'stable' }} ref={contextMenuRef}>
      <DocTitleChatRoomDesktop className="my-1" />
      <ul className="toc__list menu p-0">
        <ContextMenu
          className="menu bg-base-100 absolute z-20 m-0 rounded-md p-2 shadow-md outline-none"
          parrentRef={contextMenuRef}
          onBeforeShow={handleBeforeShow}
          onClose={handleContextMenuClose}>
          <ContextMenuItems tocItem={contextMenuState?.tocItem} />
        </ContextMenu>
        {renderedTocs}
      </ul>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export default React.memo(TOCDesktop)
