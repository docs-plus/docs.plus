import { getUnreadNotificationCount } from '@api'
import { useAuthStore, useStore } from '@stores'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import { useEffect, useRef } from 'react'

interface UseNotificationCountProps {
  workspaceId?: string | null
}

type NotificationBroadcastPayload = {
  payload: {
    event: 'INSERT' | 'UPDATE' | 'DELETE'
    workspace_id: string | null
    record: {
      id: string
      receiver_user_id: string
      readed_at: string | null
    } | null
    old_record: {
      id: string
      receiver_user_id: string
      readed_at: string | null
    } | null
  }
}

/**
 * Realtime unread-notification counter on the per-user broadcast topic
 * `notifications:<auth.uid()>`. Topic is private — the SQL trigger sends
 * with `private := true` and the `notifications_topic_access` RLS policy
 * gates SELECT; the client constructor must pass `{ config: { private:
 * true } }` or subscribe() silently fails.
 */
export const useNotificationCount = ({ workspaceId }: UseNotificationCountProps) => {
  const profile = useAuthStore((state) => state.profile)
  const unreadCount = useStore((state) => state.totalNotificationUnreadCount)
  const setUnreadCount = useStore((state) => state.setTotalNotificationUnreadCount)
  const subscriptionRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!profile?.id) return

    // Fetch initial count on mount
    const fetchInitialCount = async () => {
      const count = await getUnreadNotificationCount({
        workspace_id: workspaceId || null
      })
      setUnreadCount(count)
    }

    fetchInitialCount()

    // Skip subscription if offline
    if (!navigator.onLine) return

    // Subscribe to user-specific notification broadcast.
    // `private: true` is required for the SQL trigger's private broadcast, RLS policy on realtime.messages.
    const topic = `notifications:${profile.id}`

    const channel = supabaseClient.channel(topic, {
      config: { private: true }
    })

    // Handle INSERT - new notification
    channel.on('broadcast', { event: 'INSERT' }, (data: NotificationBroadcastPayload) => {
      const payload = data.payload

      // Only increment if notification is for current workspace (or no workspace filter)
      if (!workspaceId || payload.workspace_id === workspaceId) {
        setUnreadCount(useStore.getState().totalNotificationUnreadCount + 1)
      }
    })

    // Handle UPDATE - notification marked as read
    channel.on('broadcast', { event: 'UPDATE' }, (data: NotificationBroadcastPayload) => {
      const payload = data.payload
      const oldRecord = payload.old_record
      const newRecord = payload.record

      // Only decrement if notification is for current workspace
      if (!workspaceId || payload.workspace_id === workspaceId) {
        // Notification marked as read (readed_at changed from null to non-null)
        if (oldRecord && newRecord && !oldRecord.readed_at && newRecord.readed_at) {
          setUnreadCount(Math.max(0, useStore.getState().totalNotificationUnreadCount - 1))
        }
      }
    })

    // Handle DELETE - notification deleted
    channel.on('broadcast', { event: 'DELETE' }, (data: NotificationBroadcastPayload) => {
      const payload = data.payload
      const oldRecord = payload.old_record

      // Only decrement if notification was for current workspace and was unread
      if (!workspaceId || payload.workspace_id === workspaceId) {
        if (oldRecord && !oldRecord.readed_at) {
          setUnreadCount(Math.max(0, useStore.getState().totalNotificationUnreadCount - 1))
        }
      }
    })

    subscriptionRef.current = channel.subscribe()

    // Cleanup on unmount
    return () => {
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
    }
  }, [profile?.id, workspaceId, setUnreadCount])

  return unreadCount
}
