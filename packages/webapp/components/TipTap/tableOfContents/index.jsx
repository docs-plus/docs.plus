import React, { useCallback, useEffect, useState } from 'react'
import { CaretRight, ChatLeft } from '@icons'
import ENUMS from '../enums'
import slugify from 'slugify'
import { useStore, useChatStore, useAuthStore } from '@stores'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { toggleHeadingSection, handelScroll2Header } from './helper'
import useHandelTocUpdate from './useHandelTocUpdate'

const RenderToc = ({ children, item, renderTocs }) => {
  const { query } = useRouter()
  const setChatRoom = useChatStore((state) => state.setChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const user = useAuthStore((state) => state.profile)
  const {
    workspaceId,
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const openChatContainerHandler = useCallback(
    (item) => {
      const nodePos = editor.view.state.doc.resolve(
        editor?.view.posAtDOM(document.querySelector(`.heading[data-id="${item.id}"]`))
      )

      if (!user) {
        toast.error('Please login to use chat feature')
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

  return (
    <div
      key={item.id}
      className={`toc__item toc__item--${item.level} ${item.open ? '' : 'closed'} `}
      data-id={item.id}
      data-offsettop={item.offsetTop}>
      <span className="group">
        <span
          className={`btnFold ${item.open ? 'opened' : 'closed'}`}
          onClick={() => toggleHeadingSection(item)}>
          <CaretRight size={17} fill="#363636" />
        </span>
        <a
          className="text-black sm:line-clamp-2 sm:hover:line-clamp-3 "
          data-id={item.id}
          href={`?${item.id}`}
          onClick={(e) => handelScroll2Header(e, editor)}>
          {item.text}
        </a>
        <span className="ml-auto" onClick={() => openChatContainerHandler(item)}>
          <ChatLeft
            className={`btnChat ${headingId === item.id && '!opacity-100 fill-docsy'} transition-all ml-5 group-hover:fill-docsy hover:fill-indigo-900 cursor-pointer`}
            size={18}
          />
        </span>
      </span>

      {children.length > 0 && (
        <div className={`childrenWrapper ${item.open ? '' : 'hidden'}`}>{renderTocs(children)}</div>
      )}
    </div>
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
      <div className="toc__list ">{renderedTocs}</div>
    </div>
  )
}

export default React.memo(TableOfContent)
