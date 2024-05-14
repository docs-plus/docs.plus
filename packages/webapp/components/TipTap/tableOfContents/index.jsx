import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CaretRight, ChatLeft } from '@icons'
import ENUMS from '../enums'
import slugify from 'slugify'
import { useStore, useChatStore, useAuthStore } from '@stores'
import { useRouter } from 'next/router'
import { toggleHeadingSection, handelScroll2Header } from './helper'
import useHandelTocUpdate from './useHandelTocUpdate'
import * as toast from '@components/toast'
import AvatarStack from '@components/AvatarStack'

const Aavatart = ({ className }) => {
  return (
    <div className={`avatar-group -space-x-4 rtl:space-x-reverse ${className}`}>
      <div className="avatar border">
        <div className="w-6">
          <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" />
        </div>
      </div>
      <div className="avatar border">
        <div className="w-6">
          <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" />
        </div>
      </div>
      {/* <div className="avatar border">
        <div className="w-6">
          <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" />
        </div>
      </div> */}
      <div className="avatar placeholder border">
        <div className="w-6 bg-neutral text-neutral-content text-sm">
          <span>+9</span>
        </div>
      </div>
    </div>
  )
}

const RenderToc = ({ children, item, renderTocs }) => {
  const router = useRouter()
  const { query } = router
  const setChatRoom = useChatStore((state) => state.setChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const [activeHeading, setActiveHeading] = useState(null)
  const user = useAuthStore((state) => state.profile)
  const {
    workspaceId,
    editor: { instance: editor }
  } = useStore((state) => state.settings)
  const channels = useChatStore((state) => state.channels)
  const usersPresence = useStore((state) => state.usersPresence)

  const [presentUsers, setPresentUsers] = useState([])
  useEffect(() => {
    if (!usersPresence) return
    const precenseUsers = usersPresence.values()
    const users = Array.from(precenseUsers)
      .filter((user) => user?.channelId === item.id)
      .filter((user) => user?.status !== 'OFFLINE')

    setPresentUsers(users)
  }, [usersPresence])

  useEffect(() => {
    const url = new URL(window.location.href)
    const heading = url.searchParams.get('id')

    if (heading) setActiveHeading(heading)
  }, [router.asPath])

  const openChatContainerHandler = useCallback(
    (item) => {
      const nodePos = editor.view.state.doc.resolve(
        editor?.view.posAtDOM(document.querySelector(`.heading[data-id="${item.id}"]`))
      )

      if (!user) {
        toast.Info('Please login to use chat feature')
        document.getElementById('btn_signin')?.click()
        return
      }

      // toggle chatroom
      if (headingId === item.id) {
        return destroyChatRoom()
      }

      destroyChatRoom()

      const headingPath = nodePos.path
        .filter((x) => x?.type?.name === ENUMS.NODES.HEADING_TYPE)
        .map((x) => {
          const text = x.firstChild.textContent.trim()
          return { text, id: x.attrs.id }
        })

      const headingAddress = headingPath.map((x, index) => {
        const prevHeadingPath = headingPath
          .slice(0, index)
          .map((x) => slugify(x.text, { lower: true, strict: true }))
          .join('>')

        const url = new URL(window.location.origin + `/${query.slugs?.at(0)}`)
        url.searchParams.set('h', prevHeadingPath)
        url.searchParams.set('id', x.id)

        return {
          ...x,
          slug: slugify(x.text),
          url: url.href
        }
      })

      // TODO: change naming => open chatroom
      setChatRoom(item.id, workspaceId, headingAddress, user)
    },
    [editor, workspaceId, headingId, user]
  )

  const unreadMessage = useMemo(() => {
    return channels.get(item.id)?.unread_message_count
  }, [channels, item.id])

  return (
    <li
      key={item.id}
      className={`toc__item relative toc__item--${item.level} ${item.open ? '' : 'closed'} `}
      data-id={item.id}
      data-offsettop={item.offsetTop}>
      <a
        className={`group relative ${activeHeading === item.id ? 'active' : ''}`}
        onClick={(e) => handelScroll2Header(e, editor, setActiveHeading)}
        href={`?${item.id}`}
        data-id={item.id}>
        <span className="sm:line-clamp-3 sm:hover:line-clamp-5 toc__link">{item.text}</span>
        <span
          className={`btnFold tooltip tooltip-top  ${item.open ? 'opened' : 'closed'}`}
          onClick={() => toggleHeadingSection(item)}
          data-tip="Toggle">
          <CaretRight size={17} fill="#363636" />
        </span>
        <span
          className="btn_chat ml-auto tooltip relative tooltip-top"
          onClick={() => openChatContainerHandler(item)}
          data-tip="Chat Room">
          {unreadMessage > 0 && (
            <div className="badge badge-sm p-1 badge-accent absolute scale-90 -right-[12px] z-[1] -top-[6px]  shadow border">
              {unreadMessage}
            </div>
          )}
          <ChatLeft
            className={`btnChat ${unreadMessage > 0 ? '!opacity-100' : 'opacity-0'} ${headingId === item.id && '!opacity-100 fill-docsy'} transition-all group-hover:fill-docsy hover:fill-indigo-900 cursor-pointer`}
            size={18}
          />
        </span>

        <div className="absolute -right-9">
          {presentUsers.length > 0 && (
            <AvatarStack size={8} users={presentUsers} tooltipPosition="tooltip-left" />
          )}
        </div>
      </a>

      {children.length > 0 && (
        <ul className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>{renderTocs(children)}</ul>
      )}
    </li>
  )
}

const renderTocs = (items, headingId) => {
  const renderedItems = []

  for (let i = 0; i < items.length; ) {
    const item = items[i]
    const children = []
    let j = i + 1

    while (j < items.length && items[j].level > item.level) {
      children.push(items[j])
      j++
    }
    renderedItems.push(
      <RenderToc key={j * i} children={children} item={item} renderTocs={renderTocs} />
    )
    i = j
  }
  return renderedItems
}

const TableOfContent = ({ className }) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const { items } = useHandelTocUpdate()
  const [renderedTocs, setRenderedTocs] = useState([])

  useEffect(() => {
    if (!items.length) return

    const tocs = renderTocs(items, headingId)
    setRenderedTocs(tocs)
  }, [items, headingId])

  if (!items.length) return null

  return (
    <div className={`${className}`}>
      <ul className="toc__list menu p-0">{renderedTocs}</ul>
    </div>
  )
}

export default React.memo(TableOfContent)
