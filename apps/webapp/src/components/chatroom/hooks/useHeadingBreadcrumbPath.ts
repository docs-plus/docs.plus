import { useChatStore, useStore } from '@stores'
import { useEffect, useState } from 'react'

import { type HeadingBreadcrumbItem, resolveHeadingBreadcrumbs } from '../utils/buildHeadingPath'

/**
 * The open heading's breadcrumb path: null while it resolves, empty when the heading
 * cannot resolve (so the skeleton ends). The depth comes from the synced document, so
 * no earlier source can size the skeleton.
 */
export const useHeadingBreadcrumbPath = (): HeadingBreadcrumbItem[] | null => {
  const setOrUpdateChatRoom = useChatStore((state) => state.setOrUpdateChatRoom)
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const [headingPath, setHeadingPath] = useState<HeadingBreadcrumbItem[] | null>(null)

  const workspaceId = useStore((state) => state.settings.workspaceId)
  const editor = useStore((state) => state.settings.editor.instance)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const loading = useStore((state) => state.settings.editor.loading)

  useEffect(() => {
    if (!editor || !headingId || providerSyncing || editor.isDestroyed) return
    if (headingId === workspaceId) return

    const headingAddress = resolveHeadingBreadcrumbs(editor, headingId)
    if (headingAddress) setOrUpdateChatRoom('headingPath', headingAddress)
    setHeadingPath(headingAddress ?? [])
  }, [headingId, editor, providerSyncing, loading, workspaceId, setOrUpdateChatRoom])

  return headingPath
}
