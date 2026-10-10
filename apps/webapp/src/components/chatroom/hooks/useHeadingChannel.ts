import { getChannelIdForHeading, upsertChannel } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useLayoutEffect, useState } from 'react'
import slugify from 'slugify'

const resolveHeadingChannel = async (
  workspaceId: string,
  headingId: string,
  uid: string,
  canWrite: boolean
): Promise<string | null> => {
  const found = await getChannelIdForHeading(workspaceId, headingId)
  if (found || !canWrite) return found
  const slug = slugify(headingId, { strict: true, lower: true })
  try {
    await upsertChannel({
      workspace_id: workspaceId,
      heading_id: headingId,
      created_by: uid,
      name: slug,
      slug: 'c' + slug
    })
  } catch {
    // A refused create is not an error, and another tab may have won the race.
    // The read below decides what the chat shows.
  }
  return getChannelIdForHeading(workspaceId, headingId)
}

/** openHeadingChatroom keys a pending comment by heading id; the composer reads it by channel id. */
const adoptChannel = (headingId: string, channelId: string | null) => {
  const store = useChatStore.getState()
  if (store.chatRoom.headingId !== headingId) return
  const comment = store.workspaceSettings.channels.get(headingId)?.commentMessageMemory
  if (channelId && channelId !== headingId && comment) {
    store.setCommentMessageMemory(channelId, { ...comment, channel_id: channelId })
    store.setCommentMessageMemory(headingId, null)
  }
  // channel_info carries no heading_id, so the TOC badge learns the pair here.
  if (channelId) {
    store.setOrUpdateChannel(channelId, { id: channelId, heading_id: headingId } as never)
  }
  store.setOrUpdateChatRoom('channelId', channelId)
}

/**
 * The one place that maps the open heading to its channel row in this document (#402).
 * Writes wait for the workspace join, because their RLS needs it. A missing row is tried
 * again once writes open. Returns the read error, which the feed shows.
 */
export const useHeadingChannel = (): unknown => {
  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const workspaceId = useStore((state) => state.settings.metadata?.documentId)
  const uid = useAuthStore((state) => state.profile?.id) ?? ''
  const joinedWorkspace = useStore((state) => state.settings.joinedWorkspace) ?? false
  const canWrite = Boolean(uid && joinedWorkspace)
  const [error, setError] = useState<unknown>(null)

  // A layout effect, so a retry's undefined write lands before paint. Otherwise the
  // composer paints one null frame between the join and the retry.
  useLayoutEffect(() => {
    setError(null)
    if (!headingId || !workspaceId) return
    const { channelId, documentId } = useChatStore.getState().chatRoom
    // A resolved row never changes for its heading.
    if (typeof channelId === 'string') return
    // DocumentPage closes the chat on a document switch. As a second line, never
    // resolve against the workspace of another document.
    if (documentId && documentId !== workspaceId) return
    // A retry that may create the row is a resolve again, so the chat loads until it ends.
    if (canWrite && channelId === null) {
      useChatStore.getState().setOrUpdateChatRoom('channelId', undefined)
    }
    let cancelled = false
    resolveHeadingChannel(workspaceId, headingId, uid, canWrite)
      .then((resolved) => {
        if (!cancelled) adoptChannel(headingId, resolved)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
    return () => {
      cancelled = true
    }
  }, [headingId, workspaceId, uid, canWrite])

  return error
}
