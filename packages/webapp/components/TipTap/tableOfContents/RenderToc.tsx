import React from 'react'
import { CaretRight, ChatLeft } from '@icons'
import { useStore, useChatStore } from '@stores'
import { toggleHeadingSection, handelScroll2Header } from './helper'
import AvatarStack from '@components/AvatarStack'

import usePresentUsers from './hooks/usePresentUsers'
import useActiveHeading from './hooks/useActiveHeading'
import useOpenChatContainer from './hooks/useOpenChatContainer'
import useUnreadMessage from './hooks/useUnreadMessage'

export const RenderToc = ({ childItems, item, renderTocs }: any) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const presentUsers = usePresentUsers(item)
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
        className={`group relative ${activeHeading === item.id ? 'active' : ''}`}
        onClick={(e) => handelScroll2Header(e, editor, setActiveHeading)}
        href={`?${item.id}`}
        data-id={item.id}>
        <span className="toc__link sm:line-clamp-3 sm:hover:line-clamp-5">{item.text}</span>
        <span
          className={`btnFold tooltip tooltip-top  ${item.open ? 'opened' : 'closed'}`}
          onClick={() => toggleHeadingSection(item)}
          data-tip="Toggle">
          <CaretRight size={17} fill="#363636" />
        </span>
        <span
          className="btn_chat tooltip tooltip-top relative ml-auto"
          onClick={() => openChatContainerHandler(item)}
          data-tip="Chat Room">
          {unreadMessage > 0 && (
            <div className="badge badge-accent badge-sm absolute -right-[12px] -top-[6px] z-[1] scale-90 border  p-1 shadow">
              {unreadMessage}
            </div>
          )}
          <ChatLeft
            className={`btnChat ${unreadMessage > 0 ? '!opacity-100' : 'opacity-0'} ${headingId === item.id && 'fill-docsy !opacity-100'} cursor-pointer transition-all hover:fill-indigo-900 group-hover:fill-docsy`}
            size={18}
          />
        </span>

        <div className="absolute -right-9">
          {presentUsers.length > 0 && (
            <AvatarStack size={8} users={presentUsers} tooltipPosition="tooltip-left" />
          )}
        </div>
      </a>

      {childItems.length > 0 && (
        <ul className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>{renderTocs(childItems)}</ul>
      )}
    </li>
  )
}
