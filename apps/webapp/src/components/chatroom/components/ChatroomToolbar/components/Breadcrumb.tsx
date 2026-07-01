import { Icons } from '@icons'
import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import React, { useCallback, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useChatroomContext } from '../../../ChatroomContext'
import {
  type HeadingBreadcrumbItem,
  resolveHeadingBreadcrumbs
} from '../../../utils/buildHeadingPath'
import { ChatroomBreadcrumbSkeleton } from '../../skeleton'

type Props = {
  className?: string
}

export const Breadcrumb = ({ className }: Props) => {
  const { query } = useRouter()
  const { variant } = useChatroomContext()
  const updateChatRoom = useChatStore((state) => state.updateChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const [headingPath, setHeadingPath] = useState<HeadingBreadcrumbItem[]>([])

  const workspaceId = useStore((state) => state.settings.workspaceId)
  const metadata = useStore((state) => state.settings.metadata)
  const editor = useStore((state) => state.settings.editor.instance)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const loading = useStore((state) => state.settings.editor.loading)

  useEffect(() => {
    if (!editor || !headingId || providerSyncing || editor.isDestroyed) return
    if (headingId === workspaceId) return

    const docSlug = String(query.slugs?.at(0) ?? '')
    const headingAddress = resolveHeadingBreadcrumbs(editor, headingId, docSlug)
    if (!headingAddress) return

    updateChatRoom('headingPath', headingAddress)
    setHeadingPath(headingAddress)
  }, [headingId, editor, providerSyncing, loading, workspaceId, query, updateChatRoom])

  const openChatContainerHandler = useCallback(
    (e: React.MouseEvent, heading: HeadingBreadcrumbItem) => {
      if (variant === 'mobile') return
      e.preventDefault()
      window.history.pushState({}, '', heading.url)

      PubSub.publish(CHAT_OPEN, {
        headingId: heading.id,
        scroll2Heading: true
      })
    },
    [variant]
  )

  const scroll2Heading = (e: React.MouseEvent, heading: HeadingBreadcrumbItem) => {
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
  if (!headingPath.length || !headingId) {
    return <ChatroomBreadcrumbSkeleton variant="desktop" />
  }

  return (
    <nav className={twMerge('flex min-w-0 flex-1', className)} aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1">
        {headingPath.map((heading, index) => {
          const isLast = headingPath.length - 1 === index
          return (
            <li
              key={heading.id}
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
