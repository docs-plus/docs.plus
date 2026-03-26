import { Icons } from '@icons'
import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore, useStore } from '@stores'
import { TIPTAP_NODES } from '@types'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import React, { useCallback, useEffect, useState } from 'react'
import slugify from 'slugify'
import { twMerge } from 'tailwind-merge'

import { useChatroomContext } from '../../../ChatroomContext'

type Props = {
  className?: string
}

/**
 * Build breadcrumb path from flat doc by walking backwards through heading levels.
 * For a target heading at level N, collect the nearest preceding heading at each
 * level 1..N-1 to form the ancestor chain.
 */
function buildHeadingPath(editor: any, headingId: string): Array<{ text: string; id: string }> {
  const doc = editor.state.doc
  const result: Array<{ text: string; id: string; level: number }> = []
  let targetLevel = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)

    if (child.type.name !== TIPTAP_NODES.HEADING_TYPE) continue

    const tocId = child.attrs['toc-id'] as string
    const level = child.attrs.level as number
    const text = child.textContent?.trim() || ''

    if (tocId === headingId) {
      targetLevel = level
      result.push({ text, id: tocId, level })
      break
    }

    result.push({ text, id: tocId, level })
  }

  if (targetLevel === 0) return []

  const ancestors: Array<{ text: string; id: string }> = []
  const seen = new Set<number>()

  for (let i = result.length - 2; i >= 0; i--) {
    const h = result[i]
    if (h.level < targetLevel && !seen.has(h.level)) {
      seen.add(h.level)
      ancestors.unshift({ text: h.text, id: h.id })
      if (h.level === 1) break
    }
  }

  const target = result[result.length - 1]
  return [...ancestors, { text: target.text, id: target.id }]
}

export const Breadcrumb = ({ className }: Props) => {
  const { query } = useRouter()
  const { variant } = useChatroomContext()
  const updateChatRoom = useChatStore((state) => state.updateChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const [headingPath, setHeadingPath] = useState<any>([])

  const workspaceId = useStore((state) => state.settings.workspaceId)
  const metadata = useStore((state) => state.settings.metadata)
  const editor = useStore((state) => state.settings.editor.instance)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const loading = useStore((state) => state.settings.editor.loading)

  useEffect(() => {
    if (!editor || !headingId || providerSyncing || editor.isDestroyed) return
    if (headingId === workspaceId) return

    const path = buildHeadingPath(editor, headingId)
    if (path.length === 0) return

    const headingAddress = path.map((x, index) => {
      const prevHeadingPath = path
        .slice(0, index)
        .map((h) => slugify(h.text, { lower: true, strict: true }))
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
              {index > 0 && (
                <Icons.chevronRight size={14} className="text-base-content/40 shrink-0" />
              )}
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
