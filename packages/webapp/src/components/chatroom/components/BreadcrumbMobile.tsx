import { useChatStore, useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import { getPostAtDOM } from '@utils/index'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { LuChevronRight } from 'react-icons/lu'
import slugify from 'slugify'

const BreadcrumbMobile = () => {
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
    if (!editor || providerSyncing) return
    if (workspaceId === headingId) return

    let posAtDOM = getPostAtDOM(editor, headingId)
    if (posAtDOM === -1) {
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

  // Document root — single title
  if (workspaceId === headingId) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-base-content truncate text-sm font-medium">{metadata.title}</p>
      </div>
    )
  }

  if (!headingPath.length) return null

  const ancestors = headingPath.slice(0, -1)
  const current = headingPath[headingPath.length - 1]

  return (
    <nav className="min-w-0 flex-1" aria-label="Breadcrumb">
      {/* Line 1: Ancestor path (only if there are ancestors) */}
      {ancestors.length > 0 && (
        <div className="text-base-content/50 flex min-w-0 items-center gap-0.5 truncate text-xs leading-tight">
          {ancestors.map((h: any, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && <LuChevronRight size={10} className="shrink-0" />}
              <span className="truncate">{h.text}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      {/* Line 2: Current heading — always visible, full width */}
      <p
        className="text-base-content truncate text-sm leading-tight font-medium"
        aria-current="page">
        {current.text}
      </p>
    </nav>
  )
}

export default BreadcrumbMobile
