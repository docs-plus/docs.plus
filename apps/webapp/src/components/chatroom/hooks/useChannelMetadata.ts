import { fetchChannelInitialData, joinChannel, upsertChannel } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useEffect, useRef, useState } from 'react'
import slugify from 'slugify'

const readChannelMetadata = async (channelId: string, anchorMessageId: string | null) => {
  // message_limit: 0 — useChannelMessages owns the message window;
  // this RPC only provides channel + member + pinned metadata.
  const { data, error } = await fetchChannelInitialData({
    input_channel_id: channelId,
    message_limit: 0,
    ...(anchorMessageId && { anchor_message_id: anchorMessageId })
  })
  if (error) throw new Error(error.message)
  return data
}

/**
 * channel_info null is the server's missing-row signal. A store entry is not a row.
 * Writes wait for the workspace join, because their RLS needs it. The read after a write
 * decides membership, because joinChannel returns its refusal. Later reads skip the
 * anchor: a stale ?msg_id= stays until Close, and it would fail the read of a new row.
 */
const syncChannel = async (
  channelId: string,
  workspaceId: string | undefined,
  uid: string,
  joinedWorkspace: boolean,
  anchorMessageId: string | null,
  isCancelled: () => boolean
) => {
  let channelData = await readChannelMetadata(channelId, anchorMessageId)
  if (isCancelled()) return
  // DocumentPage closes the chat on a document switch. This guard stays as a second
  // line: never create a chat row in the workspace of another document.
  const chatDocumentId = useChatStore.getState().chatRoom.documentId
  if (
    joinedWorkspace &&
    uid &&
    workspaceId &&
    !channelData.channel_info &&
    (!chatDocumentId || chatDocumentId === workspaceId)
  ) {
    const slug = slugify(channelId, { strict: true, lower: true })
    try {
      await upsertChannel({
        id: channelId,
        workspace_id: workspaceId,
        created_by: uid,
        name: slug,
        slug: 'c' + slug
      })
    } catch {
      // A refused create is not an error. The next read decides what the chat shows.
    }
    channelData = await readChannelMetadata(channelId, null)
    if (isCancelled()) return
  }
  // The create trigger makes the creator an ADMIN member, so this join runs only
  // when the row existed or another user created it first.
  if (joinedWorkspace && uid && channelData.channel_info && !channelData.is_user_channel_member) {
    try {
      await joinChannel({ channel_id: channelId })
    } catch {
      // joinChannel throws only with no session or from its fallback select.
    }
    channelData = await readChannelMetadata(channelId, null)
    if (isCancelled()) return
  }
  useChatStore.getState().bootstrapChannel(channelId, channelData, uid || undefined)
}

/**
 * Visitors skip both writes, and a refused write shows no error badge. See chatroom
 * CLAUDE.md §Anonymous Chat Read Path.
 */
export const useChannelMetadata = (channelId: string) => {
  const [error, setError] = useState<unknown>(null)
  const [isChannelDataLoaded, setIsChannelDataLoaded] = useState(false)
  const workspaceId = useStore((state) => state.settings.metadata?.documentId)
  const uid = useAuthStore((state) => state.profile?.id) ?? ''
  const joinedWorkspace = useStore((state) => state.settings.joinedWorkspace) ?? false
  // The uid whose sync ran with writes allowed. '' when none did, so the late effect runs it once.
  const writeSyncUidRef = useRef('')

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    setError(null)
    setIsChannelDataLoaded(false)
    const loadUid = useAuthStore.getState()?.profile?.id || ''
    const joinedAtLoad = Boolean(useStore.getState().settings.joinedWorkspace)
    writeSyncUidRef.current = joinedAtLoad ? loadUid : ''
    const startMsgId =
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(location.search).get('msg_id')
    ;(async () => {
      try {
        await syncChannel(
          channelId,
          workspaceId,
          loadUid,
          joinedAtLoad,
          startMsgId,
          () => cancelled
        )
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setIsChannelDataLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [channelId, workspaceId])

  // The profile or the workspace join can land after the load (One Tap, a slow fetch).
  // Run the writes once then, and leave the loaded flag and the error alone.
  useEffect(() => {
    if (!channelId || !isChannelDataLoaded || error || !uid || !joinedWorkspace) return
    if (writeSyncUidRef.current === uid) return
    writeSyncUidRef.current = uid
    let cancelled = false
    syncChannel(channelId, workspaceId, uid, true, null, () => cancelled).catch((err) =>
      console.error('[chatroom] late channel sync failed', err)
    )
    return () => {
      cancelled = true
    }
  }, [channelId, workspaceId, uid, joinedWorkspace, isChannelDataLoaded, error])

  return { error, isChannelDataLoaded }
}
