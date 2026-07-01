import { Icons } from '@icons'
import { useChatStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'

import { type HeadingBreadcrumbItem, resolveHeadingBreadcrumbs } from '../utils/buildHeadingPath'
import { ChatroomBreadcrumbSkeleton } from './skeleton'

const BreadcrumbMobile = () => {
  const { query } = useRouter()
  const updateChatRoom = useChatStore((state) => state.updateChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const [headingPath, setHeadingPath] = useState<HeadingBreadcrumbItem[]>([])

  const workspaceId = useStore((state) => state.settings.workspaceId)
  const metadata = useStore((state) => state.settings.metadata)
  const editor = useStore((state) => state.settings.editor.instance)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const loading = useStore((state) => state.settings.editor.loading)

  useEffect(() => {
    if (!editor || providerSyncing || !headingId) return
    if (workspaceId === headingId) return

    const docSlug = String(query.slugs?.at(0) ?? '')
    const headingAddress = resolveHeadingBreadcrumbs(editor, headingId, docSlug)
    if (!headingAddress) return

    updateChatRoom('headingPath', headingAddress)
    setHeadingPath(headingAddress)
  }, [headingId, editor, providerSyncing, loading, workspaceId, query, updateChatRoom])

  if (workspaceId === headingId) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-base-content truncate text-sm font-medium">{metadata.title}</p>
      </div>
    )
  }

  if (!headingPath.length) {
    return <ChatroomBreadcrumbSkeleton variant="mobile" />
  }

  const ancestors = headingPath.slice(0, -1)
  const current = headingPath[headingPath.length - 1]

  return (
    <nav className="min-w-0 flex-1" aria-label="Breadcrumb">
      {ancestors.length > 0 && (
        <div className="text-base-content/50 flex min-w-0 items-center gap-0.5 truncate text-xs leading-tight">
          {ancestors.map((h, i) => (
            <React.Fragment key={h.id}>
              {i > 0 && <Icons.chevronRight size={10} className="shrink-0" />}
              <span className="truncate">{h.text}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <p
        className="text-base-content truncate text-sm leading-tight font-medium"
        aria-current="page">
        {current.text}
      </p>
    </nav>
  )
}

export default BreadcrumbMobile
