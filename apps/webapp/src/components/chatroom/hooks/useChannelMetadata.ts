import { fetchChannelInitialData, joinChannel } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useEffect, useRef, useState } from 'react'

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
 * `channelId` is the resolved row (useHeadingChannel). Writes wait for the workspace join,
 * because their RLS needs it. The read after a write decides membership, because joinChannel
 * returns its refusal. The read after the join skips the anchor; the first read checked it.
 */
const syncChannel = async (
  channelId: string,
  uid: string,
  joinedWorkspace: boolean,
  anchorMessageId: string | null,
  isCancelled: () => boolean
) => {
  let channelData = await readChannelMetadata(channelId, anchorMessageId)
  if (isCancelled()) return
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
 * Visitors skip the join, and a refused join shows no error badge. See chatroom
 * CLAUDE.md §Anonymous Chat Read Path. An empty `channelId` makes no read: the heading
 * has no row yet, so the feed shows its empty state once the resolve says so.
 */
export const useChannelMetadata = (channelId: string) => {
  const [error, setError] = useState<unknown>(null)
  const [isChannelDataLoaded, setIsChannelDataLoaded] = useState(false)
  const channelMissing = useChatStore((state) => state.chatRoom.channelId === null)
  const uid = useAuthStore((state) => state.profile?.id) ?? ''
  const joinedWorkspace = useStore((state) => state.settings.joinedWorkspace) ?? false
  // The uid whose sync ran with writes allowed. '' when none did, so the late effect runs it once.
  const writeSyncUidRef = useRef('')

  useEffect(() => {
    if (!channelId) {
      setIsChannelDataLoaded(channelMissing)
      return
    }
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
        await syncChannel(channelId, loadUid, joinedAtLoad, startMsgId, () => cancelled)
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setIsChannelDataLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [channelId, channelMissing])

  // The profile or the workspace join can land after the load (One Tap, a slow fetch).
  // Run the writes once then, and leave the loaded flag and the error alone.
  useEffect(() => {
    if (!channelId || !isChannelDataLoaded || error || !uid || !joinedWorkspace) return
    if (writeSyncUidRef.current === uid) return
    writeSyncUidRef.current = uid
    let cancelled = false
    syncChannel(channelId, uid, true, null, () => cancelled).catch((err) =>
      console.error('[chatroom] late channel sync failed', err)
    )
    return () => {
      cancelled = true
    }
  }, [channelId, uid, joinedWorkspace, isChannelDataLoaded, error])

  return { error, isChannelDataLoaded }
}
