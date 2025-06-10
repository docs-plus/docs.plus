import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useChatStore, useStore } from '@stores'
import { RiArrowRightSLine } from 'react-icons/ri'
import slugify from 'slugify'
import { TIPTAP_NODES } from '../../../types/tiptap'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'
import { MdAccountTree } from 'react-icons/md'
import { getPostAtDOM } from '@utils/index'
interface NotificationBreadcrumbProps {
  channelId: string
}

const NotificationBreadcrumb = ({ channelId }: NotificationBreadcrumbProps) => {
  const { query } = useRouter()
  const [headingPath, setHeadingPath] = useState<any>([])
  const [visiblePath, setVisiblePath] = useState<any>([])
  const navRef = useRef<HTMLElement>(null)

  const {
    workspaceId,
    metadata,
    editor: { instance: editor, providerSyncing, loading }
  } = useStore((state) => state.settings)

  useEffect(() => {
    if (!editor || providerSyncing || !channelId) return
    if (channelId === workspaceId) return

    let posAtDOM = getPostAtDOM(editor, channelId)
    if (posAtDOM === -1) {
      posAtDOM = getPostAtDOM(editor, '1')
    }

    if (posAtDOM === undefined) return

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

    setHeadingPath(headingAddress)
  }, [channelId, editor, providerSyncing, loading])

  useEffect(() => {
    if (headingPath.length === 0) return

    // Always show at least first and last items
    if (headingPath.length <= 3) {
      setVisiblePath(headingPath)
    } else {
      // Show first item, ellipsis, and last item
      setVisiblePath([
        headingPath[0],
        { text: '...', id: 'ellipsis', isEllipsis: true },
        headingPath[headingPath.length - 1]
      ])
    }
  }, [headingPath])

  const openChatContainerHandler = useCallback((e: any, heading: any) => {
    e.preventDefault()
    window.history.pushState({}, '', heading.url)

    PubSub.publish(CHAT_OPEN, {
      headingId: heading.id,
      scroll2Heading: true
    })
  }, [])

  // Document Root
  if (channelId === workspaceId) return <>{metadata.title}</>
  if (!headingPath.length || !channelId) return null

  return (
    <nav
      ref={navRef}
      className="scrollbar-hide flex w-full max-w-[260px] items-center gap-2 overflow-x-auto"
      aria-label="Breadcrumb">
      <MdAccountTree size={14} className="flex-shrink-0 text-gray-400" />
      <ul className="flex min-w-full flex-nowrap items-center p-0">
        {visiblePath.map((heading: any, index: number) => {
          return (
            <React.Fragment key={heading.id || index}>
              {index !== 0 && (
                <RiArrowRightSLine size={16} className="flex-shrink-0 text-gray-400" />
              )}
              <li
                aria-current={visiblePath.length - 1 === index ? 'page' : undefined}
                className="flex-shrink-0 text-xs">
                <div className="flex items-center p-0 whitespace-nowrap">
                  {heading.isEllipsis ? (
                    <span className="text-gray-500">...</span>
                  ) : visiblePath.length - 1 === index ? (
                    <span className="truncate text-gray-500">{heading.text}</span>
                  ) : (
                    <a
                      onClick={(e) => openChatContainerHandler(e, heading)}
                      href={heading.url}
                      className="truncate text-gray-500 hover:text-blue-500">
                      {heading.text}
                    </a>
                  )}
                </div>
              </li>
            </React.Fragment>
          )
        })}
      </ul>
    </nav>
  )
}

export default NotificationBreadcrumb
