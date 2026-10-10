import { Icons } from '@icons'
import { useChatStore, useStore } from '@stores'
import React from 'react'

import { useHeadingBreadcrumbPath } from '../hooks/useHeadingBreadcrumbPath'
import { ChatroomBreadcrumbSkeleton } from './skeleton'

const BreadcrumbMobile = () => {
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const headingPath = useHeadingBreadcrumbPath()

  const workspaceId = useStore((state) => state.settings.workspaceId)
  const metadata = useStore((state) => state.settings.metadata)

  if (workspaceId === headingId) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-base-content truncate text-sm font-medium">{metadata.title}</p>
      </div>
    )
  }

  if (!headingPath) {
    return <ChatroomBreadcrumbSkeleton variant="mobile" />
  }

  // A plain spacer, so screen readers do not announce an empty Breadcrumb landmark.
  if (!headingPath.length) return <div className="min-w-0 flex-1" />

  const ancestors = headingPath.slice(0, -1)
  const current = headingPath[headingPath.length - 1]

  return (
    <nav className="min-w-0 flex-1" aria-label="Breadcrumb">
      {ancestors.length > 0 && (
        <div className="text-base-content/60 flex min-w-0 items-center gap-0.5 truncate text-xs leading-tight">
          {ancestors.map((h, i) => (
            <React.Fragment key={h.id}>
              {i > 0 && (
                <Icons.chevronRight
                  size={10}
                  className="text-base-content/40 shrink-0"
                  aria-hidden
                />
              )}
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
