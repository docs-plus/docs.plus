import type { PresenceActivity, Profile, TypingIndicatorPayload } from '@types'
import debounce from 'lodash/debounce'

/** Debounce window for heading presence re-broadcasts (join + requestPresenceSync storms). */
const SHARE_COOLDOWN_MS = 600
// Must stay above two sender keepalives (2 × 3 s), so one lost resend keeps the chip.
const ACTIVITY_EXPIRY_MS = 8000
// A quicker open and close sends nothing.
const ACTIVITY_START_DELAY_MS = 300
// A presence frame also drops the chip on peers, so the resend brings it back.
const ACTIVITY_KEEPALIVE_MS = 3000
const TYPING_STOP_MS = 1000

// A Record makes a new PresenceActivity fail to compile until it is listed here.
const KNOWN_ACTIVITIES: Record<PresenceActivity, true> = {
  choosingEmoji: true,
  recordingVoice: true
}

/** The one client rule for "is present". A typing face is present; only a leave sets OFFLINE. */
export const isFacePresent = (u: Pick<Profile, 'status'>): boolean => u.status !== 'OFFLINE'

export function selectPresenceOthers(
  users: Iterable<Profile> | null | undefined,
  selfId: string | undefined | null
): Profile[] {
  if (!users) return []
  return Array.from(users).filter((u) => u.id !== selfId && isFacePresent(u))
}

export type RoomBroadcast = 'presence' | 'presenceSync' | 'requestPresenceSync' | 'typingIndicator'

export type RoomEvent =
  | { kind: 'sync' | 'join' | 'leave'; faces: unknown[] }
  | { kind: 'broadcast'; event: RoomBroadcast; payload: unknown }

/** One realtime channel. The adapter binds in `listen` before subscribe; `send` never throws. */
export interface RealtimeRoomPort {
  listen(onEvent: (event: RoomEvent) => void): void
  send(event: RoomBroadcast, payload: unknown): void
  track(profile: Profile): Promise<void>
}

export type RoomConnection = {
  /** Call on SUBSCRIBED. Authed: track, then share, then requestPresenceSync. Never rejects. */
  joined(): Promise<void>
  /** Stops inbound timers and strips Activity chips. Faces stay until the next connect. Idempotent. */
  close(): void
}

export interface PresenceRoom {
  /** Binds a fresh channel and drops every face, sync buffer and share timer. Null self is anon. */
  connect(port: RealtimeRoomPort, self: Profile | null): RoomConnection
  /** This tab's open heading, or null. Sends one presence frame per change once joined. */
  enter(headingId: string | null): void
  typing(signal: 'start' | 'stop' | 'sent'): void
  /** One activity per face, so a start replaces the current one. Returns its stop. */
  activity(activity: PresenceActivity): () => void
  /** A new avatar: re-track and re-share on the joined channel. */
  retrack(profile: Profile): void
}

type PresenceSnapshot = Partial<Profile> & { id: string; channelId?: string | null }
type PresenceChannelRow = { id: string; channelId: string }
type Timer = ReturnType<typeof setTimeout>

/** Everything one channel owns. connect replaces it whole, so faces and buffers reset together. */
type Connection = {
  port: RealtimeRoomPort
  self: Profile | null
  open: boolean
  /** Track has settled: own sends and inbound typing pass. Anon never gets here. */
  ready: boolean
  faces: Map<string, Profile>
  /** presenceSync channelIds held until a full face arrives — never stub Profiles. */
  pendingChannelIds: Map<string, string>
  lastShareAt: number
  shareTimer?: Timer
  activityExpiries: Map<string, Timer>
}

const toSnapshot = (value: unknown): PresenceSnapshot | null => {
  if (!value || typeof value !== 'object') return null
  const row = value as PresenceSnapshot
  return typeof row.id === 'string' ? row : null
}

export function createPresenceRoom(publish: (faces: Map<string, Profile>) => void): PresenceRoom {
  let conn: Connection | null = null
  let ownHeading: string | null = null

  let hasStartedTyping = false
  let currentActivity: PresenceActivity | null = null
  let activityStartSent = false
  let activityStartTimer: Timer | undefined
  let activityKeepalive: ReturnType<typeof setInterval> | undefined

  const live = (c: Connection) => c === conn && c.open

  // A published Map is never mutated: readers key caches on its identity.
  const write = (c: Connection, next: Map<string, Profile>) => {
    c.faces = next
    publish(next)
  }

  const resolveChannelId = (c: Connection, id: string, incoming?: string | null) => {
    if (typeof incoming === 'string' && incoming.length > 0) {
      c.pendingChannelIds.delete(id)
      return incoming
    }
    const buffered = c.pendingChannelIds.get(id)
    if (buffered !== undefined) c.pendingChannelIds.delete(id)
    if (buffered) return buffered
    return incoming ?? null
  }

  const mergeFace = (
    c: Connection,
    faces: Map<string, Profile>,
    presence: PresenceSnapshot,
    status: Profile['status']
  ): Profile => {
    // A tracked payload has no channelId field, so sync and join keep the one a
    // broadcast set. An explicit null or '' still clears it, and a leave clears it.
    const incoming =
      presence.channelId === undefined && isFacePresent({ status })
        ? faces.get(presence.id)?.channelId
        : presence.channelId
    return { ...presence, status, channelId: resolveChannelId(c, presence.id, incoming) } as Profile
  }

  const applyTracked = (c: Connection, entries: unknown[], status: Profile['status']) => {
    let next: Map<string, Profile> | null = null
    for (const entry of entries) {
      const snapshot = toSnapshot(entry)
      if (!snapshot) continue
      next ??= new Map(c.faces)
      next.set(snapshot.id, mergeFace(c, next, snapshot, status))
    }
    if (next) write(c, next)
  }

  const applyPresenceFrame = (c: Connection, payload: unknown) => {
    const row = toSnapshot(payload)
    if (!row) return
    const channelId = resolveChannelId(c, row.id, row.channelId)
    const next = new Map(c.faces)
    next.set(row.id, { ...row, status: row.status ?? 'ONLINE', channelId } as Profile)
    write(c, next)
  }

  const applySyncRows = (c: Connection, payload: unknown) => {
    if (!Array.isArray(payload)) return
    let next: Map<string, Profile> | null = null
    for (const row of payload) {
      if (typeof row?.id !== 'string' || typeof row?.channelId !== 'string') continue
      const existing = (next ?? c.faces).get(row.id)
      if (!existing) {
        c.pendingChannelIds.set(row.id, row.channelId)
        continue
      }
      c.pendingChannelIds.delete(row.id)
      next ??= new Map(c.faces)
      next.set(row.id, { ...existing, channelId: row.channelId })
    }
    if (next) write(c, next)
  }

  const patchFace = (c: Connection, userId: string, patch: Partial<Profile>) => {
    const face = c.faces.get(userId)
    if (!face) return
    // Keepalives resend the same activity every 3 s; skip those writes.
    if ('activity' in patch && face.activity === patch.activity) return
    write(c, new Map(c.faces).set(userId, { ...face, ...patch }))
  }

  const clearActivity = (c: Connection, userId: string) => {
    clearTimeout(c.activityExpiries.get(userId))
    c.activityExpiries.delete(userId)
    patchFace(c, userId, { activity: undefined })
  }

  const applyTypingFrame = (c: Connection, payload: TypingIndicatorPayload) => {
    const userId = payload?.user?.id
    if (typeof userId !== 'string') return
    if (payload.type === 'startTyping') patchFace(c, userId, { status: 'TYPING' })
    else if (payload.type === 'stopTyping') patchFace(c, userId, { status: 'ONLINE' })
    else if (
      payload.type === 'startActivity' &&
      payload.activity !== undefined &&
      Object.hasOwn(KNOWN_ACTIVITIES, payload.activity)
    ) {
      // The value comes from another client: drop an activity this build does not know.
      patchFace(c, userId, { activity: payload.activity })
      clearTimeout(c.activityExpiries.get(userId))
      c.activityExpiries.set(
        userId,
        setTimeout(() => clearActivity(c, userId), ACTIVITY_EXPIRY_MS)
      )
    } else if (payload.type === 'stopActivity') clearActivity(c, userId)
  }

  const flushShare = (c: Connection) => {
    const self = c.self
    if (!self?.id) return
    const rows: PresenceChannelRow[] = []
    for (const face of c.faces.values()) {
      if (face.id && face.channelId) rows.push({ id: face.id, channelId: face.channelId })
    }
    // A native track carries no channelId, so own row may be missing.
    if (ownHeading && !rows.some((row) => row.id === self.id)) {
      rows.push({ id: self.id, channelId: ownHeading })
    }
    if (ownHeading) c.port.send('presence', { ...self, channelId: ownHeading })
    if (rows.length > 0) c.port.send('presenceSync', rows)
  }

  /** Re-broadcast own heading + known heading rows — TOC AvatarStack keys on channelId. */
  const share = (c: Connection) => {
    if (!c.self?.id) return
    const now = Date.now()
    const sinceLast = now - c.lastShareAt
    if (sinceLast < SHARE_COOLDOWN_MS) {
      c.shareTimer ??= setTimeout(() => {
        c.shareTimer = undefined
        if (!live(c)) return
        c.lastShareAt = Date.now()
        flushShare(c)
      }, SHARE_COOLDOWN_MS - sinceLast)
      return
    }
    c.lastShareAt = now
    flushShare(c)
  }

  const onEvent = (c: Connection, event: RoomEvent) => {
    if (!live(c)) return
    if (event.kind !== 'broadcast') {
      if (event.kind === 'join') share(c)
      // A leave applies its first entry only, as it always has.
      if (event.kind === 'leave') applyTracked(c, event.faces.slice(0, 1), 'OFFLINE')
      else applyTracked(c, event.faces, 'ONLINE')
    } else if (event.event === 'presence') applyPresenceFrame(c, event.payload)
    else if (event.event === 'presenceSync') applySyncRows(c, event.payload)
    else if (event.event === 'requestPresenceSync') share(c)
    else if (c.ready) applyTypingFrame(c, event.payload as TypingIndicatorPayload)
  }

  const stopTimers = (c: Connection) => {
    clearTimeout(c.shareTimer)
    c.shareTimer = undefined
    for (const timer of c.activityExpiries.values()) clearTimeout(timer)
  }

  const close = (c: Connection) => {
    if (!c.open) return
    stopTimers(c)
    const stripped = [...c.activityExpiries.keys()]
    c.activityExpiries.clear()
    c.open = false
    c.ready = false
    let next: Map<string, Profile> | null = null
    for (const userId of stripped) {
      const face = c.faces.get(userId)
      if (!face || face.activity === undefined) continue
      next ??= new Map(c.faces)
      next.set(userId, { ...face, activity: undefined })
    }
    if (next) write(c, next)
  }

  const joined = async (c: Connection) => {
    if (!live(c)) return
    if (!c.self) {
      c.port.send('requestPresenceSync', {})
      return
    }
    await c.port.track(c.self).catch((err: unknown) => {
      console.error('Failed to track profile:', err)
    })
    // A track that settles after close must not revive a dead channel.
    if (!live(c)) return
    c.ready = true
    share(c)
    c.port.send('requestPresenceSync', {})
  }

  const joinedConn = (): Connection | null =>
    conn && live(conn) && conn.ready && conn.self?.id ? conn : null

  const sendTyping = (type: TypingIndicatorPayload['type'], activity?: PresenceActivity) => {
    const c = joinedConn()
    if (!c?.self) return
    const payload: TypingIndicatorPayload = { type, activity, user: { id: c.self.id } }
    c.port.send('typingIndicator', payload)
  }

  const debouncedStopTyping = debounce(() => {
    sendTyping('stopTyping')
    hasStartedTyping = false
  }, TYPING_STOP_MS)

  const stopActivity = (activity: PresenceActivity) => {
    if (currentActivity !== activity) return
    currentActivity = null
    clearTimeout(activityStartTimer)
    clearInterval(activityKeepalive)
    if (activityStartSent) sendTyping('stopActivity', activity)
    activityStartSent = false
  }

  return {
    connect(port, self) {
      if (conn) {
        stopTimers(conn)
        conn.open = false
      }
      const c: Connection = {
        port,
        self,
        open: true,
        ready: false,
        faces: new Map(),
        pendingChannelIds: new Map(),
        lastShareAt: 0,
        activityExpiries: new Map()
      }
      conn = c
      publish(c.faces)
      port.listen((event) => onEvent(c, event))
      return { joined: () => joined(c), close: () => close(c) }
    },

    enter(headingId) {
      if (headingId === ownHeading) return
      ownHeading = headingId
      const c = joinedConn()
      if (c?.self) c.port.send('presence', { ...c.self, channelId: headingId ?? '' })
    },

    typing(signal) {
      if (signal === 'start') {
        // An emoji insert fires onUpdate; it must not flash "typing" under the chip.
        if (currentActivity) return
        if (!hasStartedTyping) {
          sendTyping('startTyping')
          hasStartedTyping = true
        }
        debouncedStopTyping()
      } else if (signal === 'stop') {
        debouncedStopTyping()
      } else {
        debouncedStopTyping.cancel()
        sendTyping('stopTyping')
        hasStartedTyping = false
      }
    },

    activity(activity) {
      if (currentActivity) stopActivity(currentActivity)
      currentActivity = activity
      activityStartTimer = setTimeout(() => {
        debouncedStopTyping.cancel()
        if (hasStartedTyping) sendTyping('stopTyping')
        hasStartedTyping = false
        sendTyping('startActivity', activity)
        activityStartSent = true
        activityKeepalive = setInterval(() => {
          if (!document.hidden) sendTyping('startActivity', activity)
        }, ACTIVITY_KEEPALIVE_MS)
      }, ACTIVITY_START_DELAY_MS)
      return () => stopActivity(activity)
    },

    retrack(profile) {
      const c = joinedConn()
      if (!c || !profile.id) return
      c.self = profile
      void c.port.track(profile).catch((err: unknown) => {
        console.error('Failed to retrack avatar presence:', err)
      })
      share(c)
    }
  }
}
