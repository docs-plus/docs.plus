import { fetchChannelInitialData, joinChannel, upsertChannel } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { useEffect, useState } from 'react'
import slugify from 'slugify'

/**
 * Replaces v1 `useChannelInitialData` data load. Anon users and
 * authenticated-but-not-workspace-member visitors skip the write-side
 * bootstrap entirely per AGENTS.md §Anonymous Chat Read Path: the
 * upsertChannel + joinChannel writes both 403 under RLS for non-members,
 * but the metadata RPC + message window are read-only and PUBLIC channels
 * are visible to everyone. Failures on the optional join are swallowed
 * so a non-member can lurk without surfacing an error badge.
 */
export const useChannelMetadata = (channelId: string) => {
  const [error, setError] = useState<unknown>(null)
  const [isChannelDataLoaded, setIsChannelDataLoaded] = useState(false)
  const workspaceId = useStore((state) => state.settings.metadata?.documentId)

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    setError(null)
    setIsChannelDataLoaded(false)
    ;(async () => {
      try {
        const uid = useAuthStore.getState()?.profile?.id || ''
        // Lazy channel row creation: signed-in workspace members opening
        // a heading chatroom for the first time must create the channel
        // before joinChannel (RLS on channel_members.insert requires the
        // row to exist). Both INSERTs are gated to workspace members at
        // the RLS layer; non-members and anon callers get a soft failure
        // and fall through to the read-only path.
        const channelExists =
          useChatStore.getState().workspaceSettings.channels.get(channelId) != null
        if (!channelExists && workspaceId && uid) {
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
            // Non-workspace-member: lurk read-only.
          }
        }
        const startMsgId =
          useChatStore.getState().chatRoom.fetchMsgsFromId ||
          new URLSearchParams(location.search).get('msg_id')
        // message_limit: 0 — useChannelMessages owns the message window;
        // this RPC only provides channel + member + pinned metadata.
        const { data, error: rpcError } = await fetchChannelInitialData({
          input_channel_id: channelId,
          message_limit: 0,
          ...(startMsgId && { anchor_message_id: startMsgId })
        })
        if (cancelled) return
        if (rpcError) throw new Error(rpcError.message)
        const channelData = data as any
        if (uid && !channelData.is_user_channel_member) {
          try {
            await joinChannel({ channel_id: channelId })
            channelData.is_user_channel_member = true
          } catch {
            // Non-workspace-member: lurk read-only.
          }
        }
        useChatStore.getState().bootstrapChannel(channelId, channelData, uid || undefined)
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

  return { error, isChannelDataLoaded }
}
