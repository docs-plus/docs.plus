import { getBookmarkStats } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { type TBookmarkTab } from '@types'
import { useEffect } from 'react'

const BOOKMARK_TABS: TBookmarkTab[] = ['in progress', 'archive', 'read']

/** Writes the three tab counts. Throws when the read fails. */
export async function loadBookmarkStats(workspaceId: string | undefined) {
  const { data, error } = await getBookmarkStats({ workspaceId })
  if (error) throw error
  // The pad moved on while the read ran; its own load writes the counts.
  if (!data || useStore.getState().settings.workspaceId !== workspaceId) return

  const summary = Array.isArray(data) ? data[0] : data
  const { setBookmarkTab } = useChatStore.getState()
  setBookmarkTab('in progress', summary.unread || 0)
  setBookmarkTab('archive', summary.archived || 0)
  setBookmarkTab('read', summary.read || 0)
}

/** Reloads the open pad's counts after a bookmark change. A failure only logs. */
export function refreshBookmarkStats() {
  const { workspaceId } = useStore.getState().settings
  // No workspace sends null, and the read then counts every workspace.
  if (!workspaceId) return
  loadBookmarkStats(workspaceId).catch((error) => {
    console.error('Error fetching bookmark stats:', error)
  })
}

/** Loads the counts once per pad and workspace, so the dot shows before the panel opens. */
export function usePadBookmarkStats() {
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const userId = useAuthStore((state) => state.profile?.id)

  useEffect(() => {
    // The last pad's counts must not paint this pad's dot, even when the read fails.
    const { setBookmarkTab } = useChatStore.getState()
    for (const tab of BOOKMARK_TABS) setBookmarkTab(tab, 0)
    if (userId && workspaceId) refreshBookmarkStats()
  }, [userId, workspaceId])
}
