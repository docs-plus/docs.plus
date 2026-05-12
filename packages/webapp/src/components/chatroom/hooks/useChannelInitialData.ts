import { fetchChannelInitialData, joinChannel, upsertChannel } from '@api'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { TChannelSettings } from '@types'
import { useEffect, useState } from 'react'
import slugify from 'slugify'

interface UseChannelInitialData {
  isChannelDataLoaded: boolean
  msgLength: number
}

export const useChannelInitialData = (
  setError: (error: any) => void,
  channelId: string
): UseChannelInitialData => {
  const [isChannelDataLoaded, setIsChannelDataLoaded] = useState<boolean>(false)
  const [msgLength, setMsgLength] = useState<number>(0)
  const workspaceId = useStore((state) => state.settings.metadata?.documentId)

  // Leaf selector — see useScrollAndLoad for the rationale.
  const currentChannel = useChatStore<TChannelSettings | null>(
    (state) => state.workspaceSettings.channels.get(channelId) ?? null
  )
  const user = useAuthStore((state) => state.profile)

  const processChannelData = async (channelId: string) => {
    // Anon users are read-only. The `channels` INSERT policy is
    // `TO authenticated` (13-RLS.sql:157-162), so an anon upsert would
    // 42501 and the whole chatroom load fails. The system-user fallback
    // never worked past RLS either. For anon: skip the bootstrap and
    // rely on the channel already existing (created the first time any
    // signed-in user opened the doc); fetchChannelInitialData reads it
    // via the PUBLIC anon-select policies.
    if (currentChannel === null && workspaceId && user?.id) {
      const slug = slugify(channelId, { strict: true, lower: true })
      await upsertChannel({
        id: channelId,
        workspace_id: workspaceId,
        created_by: user.id,
        name: slug,
        slug: 'c' + slug
      })
    }

    const startMsgId =
      useChatStore.getState().chatRoom.fetchMsgsFromId ||
      new URLSearchParams(location.search).get('msg_id')

    const fetchArgs: any = {
      input_channel_id: channelId,
      message_limit: 20,
      ...(startMsgId && { anchor_message_id: startMsgId })
    }

    const { data, error: channelError } = await fetchChannelInitialData(fetchArgs)
    if (channelError) throw new Error(channelError.message)
    const channelData = data as any

    // Auto-join the channel for signed-in users who aren't yet members.
    // Must run BEFORE bootstrapChannel so the channel_member_info reflects
    // the join. Uses profile.id (not session.id): only profile-rows have a
    // corresponding public.users row; anonymous sessions carry a UUID that
    // doesn't exist there and would FK-fail.
    const userId = useAuthStore.getState()?.profile?.id || ''
    if (userId && !channelData.is_user_channel_member) {
      await joinChannel({ channel_id: channelId, member_id: userId })
      channelData.is_user_channel_member = true
    }

    // Single immer pass: 6-slice channel state lands atomically. Consumers
    // gated on readiness flags (ChatroomContext.initLoadMessages) no longer
    // observe transiently partial state between writes.
    useChatStore.getState().bootstrapChannel(channelId, channelData, userId || undefined)
    setMsgLength(channelData.last_messages?.length ?? 0)
  }

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    ;(async () => {
      setIsChannelDataLoaded(false)
      try {
        await processChannelData(channelId)
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setError(err)
        }
      } finally {
        if (!cancelled) setIsChannelDataLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  // Clear stale pagination state for the previous channel on switch/unmount.
  // Closure capture: when channelId changes c1 → c2, React invokes cleanup
  // with the old c1, then runs the new effect for c2.
  useEffect(() => {
    if (!channelId) return
    return () => {
      useChatStore.getState().clearPagination(channelId)
    }
  }, [channelId])

  return {
    isChannelDataLoaded,
    msgLength
  }
}
