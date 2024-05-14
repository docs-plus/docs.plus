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
