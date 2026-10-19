import { dbChannelMessageCountsListener, dbChannelsListener } from '@components/chatroom/sync'
import { presenceRoom, supabaseRoom } from '@services/presenceRoom'
import { selectDocumentId, useAuthStore, useChatStore, useStore } from '@stores'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import { useEffect, useRef, useState } from 'react'

type ChannelMemberRow = {
  channel_id: string
  member_id: string
  unread_message_count?: number | null
}

export const useCatchUserPresences = (enabled = true) => {
  const profile = useAuthStore((state) => state.profile)
  const workspaceId = useStore(selectDocumentId)

  const updateChannelRow = useChatStore((state) => state.updateChannelRow)
  const addChannelMember = useChatStore((state) => state.addChannelMember)

  const anonymousSubscription = useRef<RealtimeChannel | null>(null)

  // Bumped on the `online` window event so the subscription effect re-runs
  // and rebuilds the channel after a network drop.
  const [reconnectTick, setReconnectTick] = useState(0)

  useEffect(() => {
    if (!enabled) return

    const handleOnline = () => setReconnectTick((tick) => tick + 1)
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    if (!workspaceId) return

    // Skip subscriptions if offline (prevents retry spam)
    if (!navigator.onLine) return

    const channelMembersHandler = (payload: RealtimePostgresChangesPayload<ChannelMemberRow>) => {
      if (payload.table !== 'channel_members') return
      const row = payload.new as ChannelMemberRow
      const currentMembers = useChatStore.getState().channelMembers
      if (!currentMembers.has(row.channel_id)) {
        addChannelMember(row.channel_id, { ...row, id: row.member_id })
      }
      // postgres_changes omits unread on unrelated member patches — skip when absent.
      if (typeof row.unread_message_count === 'number') {
        updateChannelRow(row.channel_id, { unread_message_count: row.unread_message_count })
        useChatStore.getState().setOptimisticUnread(row.channel_id, row.unread_message_count)
      }
    }

    if (!profile) {
      const anonChannel = supabaseClient.channel(`workspace:${workspaceId}`, {
        config: { broadcast: { self: false } }
      })
      // connect drops the previous channel's faces, so stale ONLINE entries never survive.
      const room = presenceRoom.connect(supabaseRoom(anonChannel), null)
      anonymousSubscription.current = anonChannel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'channel_message_counts',
            filter: `workspace_id=eq.${workspaceId}`
          },
          dbChannelMessageCountsListener
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void room.joined()
        })
      return () => {
        room.close()
        anonymousSubscription.current?.unsubscribe()
      }
    }

    const messageSubscription = supabaseClient
      .channel(`workspace:${workspaceId}`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_members',
          filter: `member_id=eq.${profile.id}`
        },
        channelMembersHandler
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `workspace_id=eq.${workspaceId}`
        },
        dbChannelsListener
      )

    const room = presenceRoom.connect(supabaseRoom(messageSubscription), profile)

    messageSubscription.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return

      if (!navigator.onLine) {
        messageSubscription.unsubscribe()
        return
      }

      anonymousSubscription.current?.unsubscribe()

      await room.joined()
    })

    const teardown = () => {
      room.close()
      anonymousSubscription.current?.unsubscribe()
      messageSubscription.unsubscribe()
    }

    window.addEventListener('offline', teardown)

    return () => {
      teardown()
      window.removeEventListener('offline', teardown)
    }
  }, [enabled, profile, workspaceId, reconnectTick, updateChannelRow, addChannelMember])
}
