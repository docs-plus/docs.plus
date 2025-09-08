import React from 'react'
import { CaretRight, ChatLeft } from '@icons'
import { useStore, useChatStore } from '@stores'
import { toggleHeadingSection, handelScroll2Header } from './helper'
import AvatarStack from '@components/AvatarStack'

import usePresentUsers from './hooks/usePresentUsers'
import useActiveHeading from './hooks/useActiveHeading'
import useOpenChatContainer from './hooks/useOpenChatContainer'
import useUnreadMessage from './hooks/useUnreadMessage'
import useOpenChatroomHandler from './hooks/useOpenChatroomHandler'

export const RenderToc = ({ childItems, item, renderTocs }: any) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const presentUsers = usePresentUsers(item.id)
  const [activeHeading, setActiveHeading] = useActiveHeading()
  const unreadMessage = useUnreadMessage(item)
  const openChatContainerHandler = useOpenChatContainer()

  if (!editor) return

  return (
    <li
      key={item.id}
      className={`toc__item relative${item.level} ${item.open ? '' : 'closed'} `}
      data-id={item.id}
      data-offsettop={item.offsetTop}>
      <a
        className={`group relative ${headingId === item.id ? 'active' : ''} ${headingId === item.id && 'activeTocBorder bg-gray-300'}`}
        onClick={(e) => handelScroll2Header(e, editor, setActiveHeading, true)}
        href={`?${item.id}`}
        data-id={item.id}>
        <span className="toc__link">{item.text}</span>
        <span
          className={`btnFold tooltip tooltip-top ${item.open ? 'opened' : 'closed'}`}
          onClick={() => toggleHeadingSection(item)}
          data-tip="Toggle">
          <CaretRight size={17} fill="#363636" />
        </span>
        <span
          className="btn_chat tooltip tooltip-top relative ml-auto"
          onClick={() => openChatContainerHandler(item)}
          data-tip="Chat Room">
          {unreadMessage > 0 && (
            <div className="badge badge-docsy badge-sm bg-docsy border-docsy absolute top-1/2 z-[1] -translate-y-1/2 scale-90 border border-none text-white">
              {unreadMessage > 99 ? '99+' : unreadMessage}
            </div>
          )}
          <ChatLeft
            className={`btnChat ${unreadMessage > 0 && 'hidden'} group-hover:fill-docsy cursor-pointer transition-all hover:fill-indigo-900`}
            size={18}
          />
        </span>

        <div className="absolute relative -right-5">
          {presentUsers.length > 0 && (
            <AvatarStack
              size={8}
              users={presentUsers}
              showStatus={true}
              tooltipPosition="tooltip-left"
            />
          )}
        </div>
      </a>

      {childItems.length > 0 && (
        <ul className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>{renderTocs(childItems)}</ul>
      )}
    </li>
  )
}
