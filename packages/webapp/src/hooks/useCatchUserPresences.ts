import {
  dbChannelMessageCountsListner,
  dbChannelsListner
} from '@components/chatroom/hooks/listner/dbChannelsListner'
import { useAuthStore, useChatStore, useStore } from '@stores'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import { useEffect, useRef } from 'react'

export const useCatchUserPresences = () => {
  const profile = useAuthStore((state) => state.profile)
  const { workspaceId } = useStore((state) => state.settings)
  const setOrUpdateUserPresence = useStore((state) => state.setOrUpdateUserPresence)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  const updateChannelRow = useChatStore((state) => state.updateChannelRow)
  const addChannelMember = useChatStore((state) => state.addChannelMember)
  const channelMembers = useChatStore((state) => state.channelMembers)

  const ananymousSubscription = useRef<RealtimeChannel | null>(null)

  const channelMemebrs = (payload: any) => {
    if (payload.table === 'channel_members') {
      updateChannelRow(payload.new.channel_id, payload.new)
      if (!channelMembers.has(payload.new.channel_id)) {
        addChannelMember(payload.new.channel_id, { ...payload.new, id: payload.new.member_id })
      }
    }
  }

  useEffect(() => {
    if (!workspaceId) return

    // Skip subscriptions if offline (prevents retry spam)
    if (!navigator.onLine) return

    if (!profile) {
      ananymousSubscription.current = supabaseClient
        .channel(`anonymous:${workspaceId}`, {
          config: {
            broadcast: { self: true }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'channel_message_counts',
            filter: `workspace_id=eq.${workspaceId}`
          },
          dbChannelMessageCountsListner
        )
        .subscribe()
      return
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
        channelMemebrs
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `workspace_id=eq.${workspaceId}`
        },
        dbChannelsListner
      )
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // when a new user joins the channel, I need to send the current users status to the new user
        const usersPresence = useStore.getState().usersPresence

        const payload = Array.from(usersPresence.values())
          .filter((user: any) => user.channelId)
          .map((user: any) => ({ id: user.id, channelId: user.channelId }))

        if (payload.length) {
          messageSubscription.send({
            type: 'broadcast',
            event: 'presenceSync',
            payload
          })
        }

        newPresences.forEach((presence) => {
          const user: any = {
            ...presence,
            status: 'ONLINE'
          }
          setOrUpdateUserPresence(user.id, user)
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const newUser: any = {
          ...leftPresences.at(0),
          status: 'OFFLINE'
        }
        setOrUpdateUserPresence(leftPresences.at(0)?.id, newUser)
      })
      .on('broadcast', { event: 'presenceSync' }, (data) => {
        const usersPresence = useStore.getState().usersPresence
        const payload = data.payload
        if (!payload.length) return

        payload.forEach((user: any) => {
          const newUser: any = {
            ...usersPresence.get(user.id),
            ...user
          }
          setOrUpdateUserPresence(user.id, newUser)
        })
      })
      .on('broadcast', { event: 'presence' }, (data) => {
        const payload = data.payload
        setOrUpdateUserPresence(payload.id, payload)
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return

        // Skip if we went offline during subscription
        if (!navigator.onLine) {
          messageSubscription.unsubscribe()
          return
        }

        // close the anonymous subscription
        ananymousSubscription.current?.unsubscribe()

        await messageSubscription.track(profile).catch((err) => {
          console.error('Failed to track profile:', err)
        })
        setWorkspaceSetting('broadcaster', messageSubscription)
      })

    // Unsubscribe when going offline
    const handleOffline = () => {
      ananymousSubscription.current?.unsubscribe()
      messageSubscription?.unsubscribe()
    }

    window.addEventListener('offline', handleOffline)

    return () => {
      ananymousSubscription.current?.unsubscribe()
      messageSubscription?.unsubscribe()
      window.removeEventListener('offline', handleOffline)
    }
  }, [profile, workspaceId, setOrUpdateUserPresence, supabaseClient, ananymousSubscription.current])
}
