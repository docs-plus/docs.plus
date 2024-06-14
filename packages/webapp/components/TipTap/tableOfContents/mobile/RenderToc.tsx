import React from 'react'
import { CaretRight, ChatLeft } from '@icons'
import { useStore, useChatStore } from '@stores'
import { toggleHeadingSection, handelScroll2Header } from '../helper'

import useActiveHeading from '../hooks/useActiveHeading'
import useOpenChatContainer from '../hooks/useOpenChatContainer'
import useUnreadMessage from '../hooks/useUnreadMessage'

export const RenderToc = ({ childItems, item, renderTocs }: any) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const [activeHeading, setActiveHeading] = useActiveHeading()
  const unreadMessage = useUnreadMessage(item)
  const openChatContainerHandler = useOpenChatContainer()

  return (
    <li
      key={item.id}
      className={`toc__item toc__item-- relative${item.level} ${item.open ? '' : 'closed'} `}
      data-id={item.id}
      data-offsettop={item.offsetTop}>
      <a
        className={`relative ${activeHeading === item.id ? 'active overflow-hidden' : ''} `}
        onClick={(e) => handelScroll2Header(e, editor, setActiveHeading)}
        href={`?${item.id}`}
        data-id={item.id}>
        <span className="toc__link sm:line-clamp-3 sm:hover:line-clamp-5">{item.text}</span>
        <span
          className={`btnFold ${item.open ? 'opened' : 'closed'}`}
          onClick={() => toggleHeadingSection(item)}
          data-tip="Toggle">
          <CaretRight size={17} fill="#363636" />
        </span>
        <span className="block w-8 pl-8"></span>
        <span
          className="absolute right-0 ml-auto block flex  items-center justify-end overflow-hidden rounded-l-lg bg-neutral px-1 text-neutral-content"
          onClick={() => openChatContainerHandler(item)}>
          {unreadMessage > 0 && <div className="mx-1 text-sm">{unreadMessage}</div>}
          <ChatLeft
            className={`ml-1 h-6 fill-neutral-content ${headingId === item.id && '!fill-accent'}`}
            size={14}
          />
        </span>
      </a>

      {childItems.length > 0 && (
        <ul className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>{renderTocs(childItems)}</ul>
      )}
    </li>
  )
}
