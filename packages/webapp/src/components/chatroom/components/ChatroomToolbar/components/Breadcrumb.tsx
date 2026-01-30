import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore, useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import { getPostAtDOM } from '@utils/index'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import React, { useCallback, useEffect, useState } from 'react'
import { LuChevronRight } from 'react-icons/lu'
import slugify from 'slugify'
import { twMerge } from 'tailwind-merge'

import { useChatroomContext } from '../../../ChatroomContext'

type Props = {
  className?: string
}

export const Breadcrumb = ({ className }: Props) => {
  const { query } = useRouter()
  const { variant } = useChatroomContext()
  const updateChatRoom = useChatStore((state) => state.updateChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const [headingPath, setHeadingPath] = useState<any>([])

  const {
    workspaceId,
    metadata,
    editor: { instance: editor, providerSyncing, loading }
  } = useStore((state) => state.settings)

  useEffect(() => {
    if (!editor || !headingId || providerSyncing || editor.isDestroyed) return
    if (headingId === workspaceId) return

    let posAtDOM = getPostAtDOM(editor, headingId)
    if (posAtDOM == null || posAtDOM < 0) {
      posAtDOM = getPostAtDOM(editor, '1')
    }
    if (posAtDOM == null || posAtDOM < 0) return

    const nodePos = editor.view.state.doc.resolve(posAtDOM) as any

    const headingPath = nodePos.path
      .filter((x: any) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
      .map((x: any) => {
        const text = x.firstChild.textContent.trim()
        return { text, id: x.attrs.id }
      })

    const headingAddress = headingPath.map((x: any, index: any) => {
      const prevHeadingPath = headingPath
        .slice(0, index)
        .map((x: any) => slugify(x.text, { lower: true, strict: true }))
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

    updateChatRoom('headingPath', headingAddress)
    setHeadingPath(headingAddress)
  }, [headingId, editor, providerSyncing, loading])

  const openChatContainerHandler = useCallback((e: any, heading: any) => {
    if (variant === 'mobile') return
    e.preventDefault()
    window.history.pushState({}, '', heading.url)

    PubSub.publish(CHAT_OPEN, {
      headingId: heading.id,
      scroll2Heading: true
    })
  }, [])

  const scroll2Heading = (e: any, heading: any) => {
    e.preventDefault()
    PubSub.publish(CHAT_OPEN, {
      headingId: heading.id,
      scroll2Heading: true,
      toggleRoom: false
    })
  }

  // Document Root
  if (headingId === workspaceId) {
    return <span className="text-base-content truncate text-sm font-medium">{metadata.title}</span>
  }
  if (!headingPath.length || !headingId) return null

  return (
    <nav className={twMerge('flex min-w-0 flex-1', className)} aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1">
        {headingPath.map((heading: any, index: number) => {
          const isLast = headingPath.length - 1 === index
          return (
            <li
              key={index}
              className="flex min-w-0 items-center gap-1"
              aria-current={isLast ? 'page' : undefined}>
              {index > 0 && <LuChevronRight size={14} className="text-base-content/40 shrink-0" />}
              {isLast ? (
                <button
                  onClick={(e) => scroll2Heading(e, heading)}
                  className="text-base-content hover:text-primary truncate text-sm font-medium transition-colors">
                  {heading.text}
                </button>
              ) : (
                <a
                  onClick={(e) => openChatContainerHandler(e, heading)}
                  href={heading.url}
                  className="text-base-content/60 hover:text-primary truncate text-sm transition-colors">
                  {heading.text}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
