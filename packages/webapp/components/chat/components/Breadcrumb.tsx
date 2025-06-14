import React, { useCallback, useEffect, useState } from 'react'
import { useChatStore, useStore } from '@stores'
import { IoMdGitBranch } from 'react-icons/io'
import { RiArrowRightSLine } from 'react-icons/ri'
import slugify from 'slugify'
import { TIPTAP_NODES } from '../../../types/tiptap'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'
import { getPostAtDOM } from '@utils/index'

const Breadcrumb = () => {
  const { query } = useRouter()
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
    if (posAtDOM === -1) {
      posAtDOM = getPostAtDOM(editor, '1')
    }

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
    e.preventDefault()
    window.history.pushState({}, '', heading.url)

    PubSub.publish(CHAT_OPEN, {
      headingId: heading.id,
      scroll2Heading: true
    })
  }, [])

  // Document Root
  if (headingId === workspaceId) return <>{metadata.title}</>
  if (!headingPath.length || !headingId) return null

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ul className="menu menu-horizontal flex items-center p-0">
        {headingPath.map((heading: any, index: number) => {
          return (
            <React.Fragment key={index}>
              {index === 0 ? (
                // <IoMdGitBranch size={18} className="mr-1" />
                ''
              ) : (
                <RiArrowRightSLine size={20} />
              )}
              <li key={index} aria-current={headingPath.length - 1 === index ? 'page' : undefined}>
                <div className="flex items-center px-1.5 whitespace-nowrap">
                  {headingPath.length - 1 === index ? (
                    <span className={headingPath.length > 1 ? '!font-bold' : ''}>
                      {heading.text}
                    </span>
                  ) : (
                    <a
                      onClick={(e) => openChatContainerHandler(e, heading)}
                      href={heading.url}
                      target="_blank"
                      className="">
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

export default Breadcrumb
