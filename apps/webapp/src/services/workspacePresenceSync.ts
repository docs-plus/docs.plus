import { useAuthStore, useChatStore, useStore } from '@stores'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Profile } from '@types'

/** Debounce window for heading presence re-broadcasts (join + requestPresenceSync storms). */
const SHARE_COOLDOWN_MS = 600

export type PresenceChannelRow = { id: string; channelId: string }

export type PresenceBroadcastPayload = Profile & { channelId: string }

/** Native presence + broadcast shapes share id; channelId is broadcast/sync-only. */
export type PresenceSnapshot = Partial<Profile> & {
  id?: string
  channelId?: string
}

const lastShareAt = new Map<string, number>()
const pendingShare = new Map<string, ReturnType<typeof setTimeout>>()

export const toPresenceSnapshot = (value: unknown): PresenceSnapshot | null => {
  if (!value || typeof value !== 'object') return null
  const row = value as PresenceSnapshot
  return typeof row.id === 'string' ? row : null
}

const profileFromPresence = (
  presence: PresenceSnapshot,
  status: Profile['status']
): Profile | null => {
  if (typeof presence.id !== 'string') return null
  return {
    ...presence,
    id: presence.id,
    status,
    channelId: presence.channelId ?? null
  } as Profile
}

export const seedPresenceSnapshot = (
  channel: RealtimeChannel,
  setOrUpdateUserPresence: (userId: string, userData: Profile) => void
) => {
  const state = channel.presenceState() as Record<string, PresenceSnapshot[]>
  for (const entries of Object.values(state)) {
    for (const presence of entries) {
      const profile = profileFromPresence(presence, 'ONLINE')
      if (profile) setOrUpdateUserPresence(profile.id, profile)
    }
  }
}

const buildPresenceSyncPayload = (
  profile: Profile | null | undefined
): { headingId: string | null; payload: PresenceChannelRow[] } => {
  const headingId = useChatStore.getState().chatRoom.headingId
  const usersPresence = useStore.getState().usersPresence
  const payload: PresenceChannelRow[] = []

  for (const user of usersPresence.values()) {
    if (user.id && user.channelId) {
      payload.push({ id: user.id, channelId: user.channelId })
    }
  }

  if (profile?.id && headingId && !payload.some((row) => row.id === profile.id)) {
    payload.push({ id: profile.id, channelId: headingId })
  }

  return { headingId: headingId ?? null, payload }
}

export const broadcastChatPresence = (
  channel: RealtimeChannel,
  profile: Profile,
  channelId: string
) => {
  try {
    channel.send({
      type: 'broadcast',
      event: 'presence',
      payload: { ...profile, channelId } satisfies PresenceBroadcastPayload
    })
  } catch (error) {
    console.error('Failed to broadcast presence:', error)
  }
}

/** Chatroom store entry points — no-ops when broadcaster or channelId is missing. */
export const sendPresenceBroadcast = (
  channel: RealtimeChannel | null | undefined,
  profile: Profile,
  channelId: string | null | undefined
) => {
  if (!channel || !profile.id) return
  if (!channelId) {
    try {
      channel.send({
        type: 'broadcast',
        event: 'presence',
        payload: { ...profile, channelId: '' }
      })
    } catch (error) {
      console.error('Failed to broadcast presence:', error)
    }
    return
  }
  broadcastChatPresence(channel, profile, channelId)
}

const flushHeadingPresenceShare = (channel: RealtimeChannel) => {
  const profile = useAuthStore.getState().profile
  if (!profile?.id) return

  const { headingId, payload } = buildPresenceSyncPayload(profile)

  if (headingId) {
    broadcastChatPresence(channel, profile, headingId)
  }

  if (payload.length > 0) {
    channel.send({
      type: 'broadcast',
      event: 'presenceSync',
      payload
    })
  }
}

/** Re-broadcast open chat + known heading channels — TOC AvatarStack keys on channelId. */
export const shareHeadingPresenceWithRoom = (
  channel: RealtimeChannel,
  profile: Profile | null | undefined
) => {
  if (!profile?.id) return

  const key = channel.topic
  const now = Date.now()
  const last = lastShareAt.get(key) ?? 0

  if (now - last < SHARE_COOLDOWN_MS) {
    if (!pendingShare.has(key)) {
      pendingShare.set(
        key,
        setTimeout(
          () => {
            pendingShare.delete(key)
            lastShareAt.set(key, Date.now())
            flushHeadingPresenceShare(channel)
          },
          SHARE_COOLDOWN_MS - (now - last)
        )
      )
    }
    return
  }

  lastShareAt.set(key, Date.now())
  flushHeadingPresenceShare(channel)
}

export const requestPresenceSync = (channel: RealtimeChannel) => {
  channel.send({
    type: 'broadcast',
    event: 'requestPresenceSync',
    payload: {}
  })
}

export const applyPresenceSyncPayload = (
  payload: unknown,
  setOrUpdateUserPresence: (userId: string, userData: Profile) => void
) => {
  if (!Array.isArray(payload) || payload.length === 0) return

  const usersPresence = useStore.getState().usersPresence
  for (const row of payload) {
    if (typeof row?.id !== 'string' || typeof row?.channelId !== 'string') continue
    const existing = usersPresence.get(row.id)
    setOrUpdateUserPresence(row.id, {
      ...existing,
      id: row.id,
      channelId: row.channelId,
      status: existing?.status ?? 'ONLINE'
    } as Profile)
  }
}

export const applyPresenceBroadcast = (
  payload: unknown,
  setOrUpdateUserPresence: (userId: string, userData: Profile) => void
) => {
  const row = toPresenceSnapshot(payload)
  if (!row || typeof row.id !== 'string') return
  setOrUpdateUserPresence(row.id, { ...row, status: row.status ?? 'ONLINE' } as Profile)
}

export type WorkspacePresenceListenerDeps = {
  setOrUpdateUserPresence: (userId: string, userData: Profile) => void
  onPresenceJoin?: (channel: RealtimeChannel) => void
  onRequestPresenceSync?: (channel: RealtimeChannel) => void
}

/** Shared realtime presence + broadcast wiring for anon and authed workspace channels. */
export const attachWorkspacePresenceListeners = (
  channel: RealtimeChannel,
  deps: WorkspacePresenceListenerDeps
): RealtimeChannel => {
  const { setOrUpdateUserPresence, onPresenceJoin, onRequestPresenceSync } = deps

  channel
    .on('presence', { event: 'sync' }, () => {
      seedPresenceSnapshot(channel, setOrUpdateUserPresence)
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      onPresenceJoin?.(channel)
      for (const presence of newPresences) {
        const snapshot = toPresenceSnapshot(presence)
        if (!snapshot) continue
        const user = profileFromPresence(snapshot, 'ONLINE')
        if (user) setOrUpdateUserPresence(user.id, user)
      }
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const snapshot = toPresenceSnapshot(leftPresences.at(0))
      const user = snapshot ? profileFromPresence(snapshot, 'OFFLINE') : null
      if (user) setOrUpdateUserPresence(user.id, user)
    })
    .on('broadcast', { event: 'presenceSync' }, (data) => {
      applyPresenceSyncPayload(data.payload, setOrUpdateUserPresence)
    })
    .on('broadcast', { event: 'presence' }, (data) => {
      applyPresenceBroadcast(data.payload, setOrUpdateUserPresence)
    })

  if (onRequestPresenceSync) {
    channel.on('broadcast', { event: 'requestPresenceSync' }, () => {
      onRequestPresenceSync(channel)
    })
  }

  return channel
}

export const clearPresenceShareTimers = (channel: RealtimeChannel) => {
  const pending = pendingShare.get(channel.topic)
  if (pending) {
    clearTimeout(pending)
    pendingShare.delete(channel.topic)
  }
  lastShareAt.delete(channel.topic)
}

export const clearAllPresenceShareTimers = () => {
  for (const pending of pendingShare.values()) {
    clearTimeout(pending)
  }
  pendingShare.clear()
  lastShareAt.clear()
}
