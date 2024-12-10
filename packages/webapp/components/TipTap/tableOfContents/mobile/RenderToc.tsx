import React, { useEffect } from 'react'
import { CaretRight, ChatLeft } from '@icons'
import { useStore, useChatStore } from '@stores'
import { toggleHeadingSection, handelScroll2Header } from '../helper'

import useActiveHeading from '../hooks/useActiveHeading'
import useOpenChatContainer from '../hooks/useOpenChatContainer'
import useUnreadMessage from '../hooks/useUnreadMessage'

import { MdOutlineArrowDropDown } from 'react-icons/md'
import { useModal } from '@components/ui/ModalLeftToRight'

export const RenderToc = ({ childItems, item, renderTocs }: any) => {
  const { close: closeModal } = useModal()

  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const [activeHeading, setActiveHeading] = useActiveHeading()
  const unreadMessage = useUnreadMessage(item)
  const openChatContainerHandler = useOpenChatContainer()

  useEffect(() => {
    if (!unreadMessage) return

    const element = document.querySelector(
      `.wrapBlock[data-id="${item.id}"] > .buttonWrapper .btn_openChatBox`
    )
    if (!element) return
    if (unreadMessage > 0) {
      element.setAttribute('data-unread-count', unreadMessage.toString())
    } else {
      element.removeAttribute('data-unread-count')
    }
  }, [unreadMessage])

  if (!editor) return

  return (
    <li
      key={item.id}
      className={`toc__item relative w-full${item.level} ${item.open ? '' : 'closed'} `}
      data-id={item.id}
      data-offsettop={item.offsetTop}>
      <a
        className={`relative !py-2 ${item.level === 1 ? 'ml-3' : ''} ${activeHeading === item.id ? 'active overflow-hidden' : ''} `}
        onClick={(e) => {
          handelScroll2Header(e, editor, setActiveHeading)
          closeModal()
        }}
        href={`?${item.id}`}
        data-id={item.id}>
        <span
          className={`btnFold ${item.open ? 'opened' : 'closed'}`}
          onClick={() => toggleHeadingSection(item)}
          data-tip="Toggle">
          <CaretRight size={17} fill="#363636" />
        </span>
        <span className="toc__link">{item.text}</span>

        <span className="block w-8 pl-8"></span>
        <span
          className="btn_openChatBox flex items-center justify-end overflow-hidden bg-neutral text-neutral-content"
          onClick={() => {
            openChatContainerHandler(item)
            closeModal()
          }}
          data-unread-count={unreadMessage > 0 ? unreadMessage : ''}>
          <ChatLeft
            className={`chatLeft fill-neutral-content ${headingId === item.id && '!fill-accent'}`}
            size={14}
          />
          <MdOutlineArrowDropDown size={20} className="arrowDown" />
        </span>
      </a>

      {childItems.length > 0 && (
        <ul className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>{renderTocs(childItems)}</ul>
      )}
    </li>
  )
}
