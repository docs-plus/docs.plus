import { getChannels, getChannelsWithMessageCounts, joinWorkspace } from '@api'
import { closeOpenChatRoom } from '@services/openHeadingChatroom'
import { useAuthStore, useChatStore, useStore } from '@stores'
import type { Channel } from '@types'
import type { DocumentMetadata } from '@utils/fetchDocument'
import { logger } from '@utils/logger'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import useTouchDocumentOpened from './useTouchDocumentOpened'

// A visitor has no read cursor, so the channel total stands in for the unread count.
async function fetchChannels(documentId: string, userId: string | undefined): Promise<Channel[]> {
  if (!userId) {
    const { data: channelMessageCounts } = await getChannelsWithMessageCounts(documentId)
    return (
      channelMessageCounts?.map((channel: Channel) =>
        channel ? { ...channel, unread_message_count: channel.count?.message_count || 0 } : channel
      ) || []
    )
  }

  const { data } = await getChannels(documentId, userId)
  return data || []
}

/**
 * The Pad session. It seeds the store, loads channels and joins the workspace.
 * The pad page stays mounted across a document switch, so all three reset for a new one.
 * It never gates rendering: the provider stays the page's only gate.
 */
export default function usePadSession(doc: DocumentMetadata): void {
  const { documentId } = doc
  const userId = useAuthStore((state) => state.profile?.id)
  const authLoading = useAuthStore((state) => state.loading)
  const sessionKey = `${userId ?? ''}:${documentId}`
  // The key whose channel load ended, either way. The join waits for it.
  const [channelsSettledKey, setChannelsSettledKey] = useState('')
  const channelsLoading = channelsSettledKey !== sessionKey
  const channelsLoadedKeyRef = useRef('')
  const joinKeyRef = useRef('')

  // Close A's room before B paints, while the presence channel is still A's.
  useLayoutEffect(() => closeOpenChatRoom, [documentId])

  // bulkSetChannels only merges, so this is the only clear on a switch. Forget the
  // loaded key too: a quick A to B to A must load A's channels again.
  useEffect(() => {
    channelsLoadedKeyRef.current = ''
    useChatStore.getState().clearAndInitialChannels([])
  }, [documentId])

  useEffect(() => {
    if (authLoading || channelsLoadedKeyRef.current === sessionKey) return
    let live = true
    fetchChannels(documentId, userId)
      .then((channels) => {
        if (!live) return
        useChatStore.getState().bulkSetChannels(channels)
        channelsLoadedKeyRef.current = sessionKey
      })
      .catch((err) => logger.error('[Workspace initialization error]', err, { documentId }))
      .finally(() => {
        if (live) setChannelsSettledKey(sessionKey)
      })
    return () => {
      live = false
    }
  }, [authLoading, sessionKey, documentId, userId])

  // `metadata.documentId` is also the workspace id. A passive effect, so the presence
  // channel moves only after the room closed above.
  useEffect(() => {
    useStore.getState().setWorkspaceSetting('metadata', doc)
  }, [doc])

  // `joined` means this user joined this document's workspace. Chat writes and the
  // Follow toggle need that row. A new pair resets it; a late answer for an old pair
  // does nothing.
  useEffect(() => {
    joinKeyRef.current = sessionKey
    const { settings, setWorkspaceSetting } = useStore.getState()
    if (settings.workspaceJoin !== 'pending') setWorkspaceSetting('workspaceJoin', 'pending')
    return () => {
      joinKeyRef.current = ''
    }
  }, [sessionKey])

  useEffect(() => {
    if (!userId || !documentId || channelsLoading) return
    const { setWorkspaceSetting } = useStore.getState()
    // join_workspace (SECURITY DEFINER) is the only writer of the workspace row.
    joinWorkspace({ workspaceId: documentId })
      .then((response) => {
        if (joinKeyRef.current !== sessionKey) return
        if (response.error) throw response.error
        setWorkspaceSetting('workspaceJoin', 'joined')
      })
      .catch((error) => {
        console.error('[workspace], joinWorkspaceRequest!', error)
        if (joinKeyRef.current === sessionKey) setWorkspaceSetting('workspaceJoin', 'failed')
      })
  }, [userId, documentId, channelsLoading, sessionKey])

  useTouchDocumentOpened(documentId, doc.ownerId)
}
