import { useChatStore, useStore } from '@stores'
import type { RealtimeChannel } from '@supabase/supabase-js'

import {
  createPresenceRoom,
  type RealtimeRoomPort,
  type RoomBroadcast
} from './workspacePresenceSync'

const ROOM_BROADCASTS: RoomBroadcast[] = [
  'presence',
  'presenceSync',
  'requestPresenceSync',
  'typingIndicator'
]

const logSendError = (error: unknown) => console.error('Failed to broadcast presence:', error)

/** Supabase adapter. The caller still owns the channel config, subscribe and unsubscribe. */
export const supabaseRoom = (channel: RealtimeChannel): RealtimeRoomPort => ({
  listen(onEvent) {
    channel
      .on('presence', { event: 'sync' }, () => {
        onEvent({ kind: 'sync', faces: Object.values(channel.presenceState()).flat() })
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        onEvent({ kind: 'join', faces: newPresences })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        onEvent({ kind: 'leave', faces: leftPresences })
      })
    for (const event of ROOM_BROADCASTS) {
      channel.on('broadcast', { event }, ({ payload }) => {
        onEvent({ kind: 'broadcast', event, payload })
      })
    }
  },
  send(event, payload) {
    try {
      channel.send({ type: 'broadcast', event, payload }).catch(logSendError)
    } catch (error) {
      logSendError(error)
    }
  },
  async track(profile) {
    await channel.track(profile)
  }
})

/** The only writer of `usersPresence`. */
export const presenceRoom = createPresenceRoom((faces) =>
  useStore.setState({ usersPresence: faces })
)

// The open heading is watched, not called, so chat store setters send nothing themselves.
presenceRoom.enter(useChatStore.getState().chatRoom.headingId ?? null)
useChatStore.subscribe((state, prev) => {
  const headingId = state.chatRoom.headingId
  if (headingId !== prev.chatRoom.headingId) presenceRoom.enter(headingId ?? null)
})
