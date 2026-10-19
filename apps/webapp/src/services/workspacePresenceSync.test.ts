import type { PresenceActivity, Profile, TypingIndicatorPayload } from '@types'

import {
  createPresenceRoom,
  type RealtimeRoomPort,
  type RoomBroadcast,
  type RoomEvent,
  selectPresenceOthers
} from './workspacePresenceSync'

const ME = { id: 'me', username: 'me' } as Profile

/** In-memory adapter: tests drive inbound events with emit and read outbound frames from sent. */
function memoryRoom(track: RealtimeRoomPort['track'] = async () => {}) {
  let onEvent: ((event: RoomEvent) => void) | null = null
  const sent: { event: RoomBroadcast; payload: unknown }[] = []
  const port: RealtimeRoomPort = {
    listen: (handler) => {
      onEvent = handler
    },
    send: (event, payload) => {
      sent.push({ event, payload })
    },
    track
  }
  const emit = (event: RoomEvent) => onEvent?.(event)
  const frame = (event: RoomBroadcast, payload: unknown) =>
    emit({ kind: 'broadcast', event, payload })
  const typing = (userId: string, type: TypingIndicatorPayload['type'], activity?: string) =>
    frame('typingIndicator', { type, activity, user: { id: userId } })
  return { port, sent, emit, frame, typing }
}

let faces: Map<string, Profile>
const newRoom = () => createPresenceRoom((next) => (faces = next))

async function joinedRoom(self: Profile | null = ME) {
  const room = newRoom()
  const wire = memoryRoom()
  const conn = room.connect(wire.port, self)
  await conn.joined()
  wire.sent.length = 0
  return { room, wire, conn }
}

const typingSent = (sent: { event: RoomBroadcast; payload: unknown }[]) =>
  sent
    .filter((frame) => frame.event === 'typingIndicator')
    .map(({ payload }) => {
      const { type, activity } = payload as TypingIndicatorPayload
      return activity ? `${type}:${activity}` : type
    })

const setHidden = (hidden: boolean) =>
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })

beforeEach(() => {
  jest.useFakeTimers()
  setHidden(false)
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('Presence awareness room: faces', () => {
  // Regression: 4a5888288 (a sync erased the heading a broadcast had set).
  it('keeps a broadcast heading through sync and join; null, empty or a leave clears it', () => {
    const wire = memoryRoom()
    newRoom().connect(wire.port, null)

    wire.frame('presence', { id: 'b', channelId: 'h1' })
    wire.emit({ kind: 'sync', faces: [{ id: 'b' }] })
    wire.emit({ kind: 'join', faces: [{ id: 'c' }] })
    expect(faces.get('b')?.channelId).toBe('h1')

    wire.emit({ kind: 'join', faces: [{ id: 'b', channelId: '' }] })
    expect(faces.get('b')?.channelId).toBe('')
    wire.frame('presence', { id: 'b', channelId: 'h1' })
    wire.emit({ kind: 'sync', faces: [{ id: 'b', channelId: null }] })
    expect(faces.get('b')?.channelId).toBeNull()

    wire.frame('presence', { id: 'b', channelId: 'h1' })
    wire.emit({ kind: 'leave', faces: [{ id: 'b' }] })
    expect(faces.get('b')).toMatchObject({ status: 'OFFLINE', channelId: null })
  })

  // Regression: 656e1e218 (a departed face must drop out of the others list).
  it('keeps a typing face present, and keeps a departed face OFFLINE but not present', async () => {
    const { wire } = await joinedRoom()
    wire.emit({ kind: 'join', faces: [{ id: 'b' }] })
    wire.typing('b', 'startTyping')
    expect(faces.get('b')?.status).toBe('TYPING')
    expect(selectPresenceOthers(faces.values(), ME.id).map((u) => u.id)).toEqual(['b'])

    wire.emit({ kind: 'leave', faces: [{ id: 'b' }] })
    expect(faces.get('b')).toMatchObject({ status: 'OFFLINE', channelId: null })
    expect(selectPresenceOthers(faces.values(), ME.id)).toEqual([])
  })

  it('ignores inbound typing until track settles', () => {
    const wire = memoryRoom()
    newRoom().connect(wire.port, ME)
    wire.emit({ kind: 'join', faces: [{ id: 'b' }] })
    wire.typing('b', 'startTyping')
    expect(faces.get('b')?.status).toBe('ONLINE')
  })

  it('drops faces and presenceSync buffers together on connect, and ignores the old channel', () => {
    const room = newRoom()
    const first = memoryRoom()
    room.connect(first.port, null)
    first.frame('presenceSync', [{ id: 'x', channelId: 'h9' }])
    expect(faces.has('x')).toBe(false)
    first.emit({ kind: 'join', faces: [{ id: 'x' }] })
    expect(faces.get('x')?.channelId).toBe('h9')

    first.frame('presenceSync', [{ id: 'y', channelId: 'h9' }])
    const second = memoryRoom()
    room.connect(second.port, null)
    expect(faces.size).toBe(0)
    second.emit({ kind: 'join', faces: [{ id: 'y' }] })
    expect(faces.get('y')?.channelId).toBeNull()

    first.emit({ kind: 'join', faces: [{ id: 'z' }] })
    expect(faces.has('z')).toBe(false)
  })

  it('expires a peer Activity at 8 s, drops unknown values, skips keepalive writes, and close strips it', async () => {
    const { wire, conn } = await joinedRoom()
    wire.emit({ kind: 'join', faces: [{ id: 'b' }] })

    wire.typing('b', 'startActivity', 'choosingEmoji')
    const afterStart = faces
    jest.advanceTimersByTime(3000)
    wire.typing('b', 'startActivity', 'choosingEmoji')
    expect(faces).toBe(afterStart)
    jest.advanceTimersByTime(7999)
    expect(faces.get('b')?.activity).toBe('choosingEmoji')
    jest.advanceTimersByTime(1)
    expect(faces.get('b')?.activity).toBeUndefined()

    wire.typing('b', 'startActivity', 'dancing')
    expect(faces.get('b')?.activity).toBeUndefined()

    wire.typing('b', 'startActivity', 'recordingVoice')
    conn.close()
    expect(faces.get('b')).toMatchObject({ id: 'b', activity: undefined })
  })
})

describe('Presence awareness room: own frames', () => {
  it('shares once at once and once trailing per 600 ms, and only when signed in', async () => {
    const room = newRoom()
    room.enter('h1')
    const wire = memoryRoom()
    await room.connect(wire.port, ME).joined()
    const ownRow = [{ id: 'me', channelId: 'h1' }]
    expect(wire.sent.map((f) => f.event)).toEqual([
      'presence',
      'presenceSync',
      'requestPresenceSync'
    ])
    expect(wire.sent[1].payload).toEqual(ownRow)

    wire.sent.length = 0
    wire.emit({ kind: 'join', faces: [{ id: 'b' }] })
    wire.emit({ kind: 'join', faces: [{ id: 'c' }] })
    wire.frame('requestPresenceSync', {})
    expect(wire.sent).toEqual([])
    jest.advanceTimersByTime(600)
    expect(wire.sent.map((f) => f.event)).toEqual(['presence', 'presenceSync'])
    jest.advanceTimersByTime(5000)
    expect(wire.sent).toHaveLength(2)

    const anon = await joinedRoom(null)
    anon.room.enter('h1')
    anon.wire.emit({ kind: 'join', faces: [{ id: 'b' }] })
    anon.wire.frame('requestPresenceSync', {})
    jest.advanceTimersByTime(5000)
    expect(anon.wire.sent).toEqual([])
  })

  it('sends nothing when a track settles after a reconnect', async () => {
    let settle = () => {}
    const old = memoryRoom(() => new Promise<void>((resolve) => (settle = resolve)))
    const room = newRoom()
    room.enter('h1')
    const pending = room.connect(old.port, ME).joined()
    room.connect(memoryRoom().port, ME)
    settle()
    await pending
    old.emit({ kind: 'join', faces: [{ id: 'b' }] })
    jest.advanceTimersByTime(5000)
    expect(old.sent).toEqual([])
    expect(faces.size).toBe(0)
  })

  it('sends one presence frame per heading change, and nothing before track', async () => {
    const room = newRoom()
    const wire = memoryRoom()
    const conn = room.connect(wire.port, ME)
    room.enter('h1')
    expect(wire.sent).toEqual([])

    await conn.joined()
    wire.sent.length = 0
    room.enter('h1')
    room.enter('h2')
    room.enter(null)
    expect(wire.sent.map((f) => (f.payload as Profile).channelId)).toEqual(['h2', ''])
  })
})

describe('Presence awareness room: composer sender', () => {
  const activity = (room: ReturnType<typeof newRoom>, value: PresenceActivity) =>
    room.activity(value)

  it('sends startActivity after 300 ms, and a quicker open and close sends nothing', async () => {
    const { room, wire } = await joinedRoom()
    const stop = activity(room, 'choosingEmoji')
    jest.advanceTimersByTime(299)
    stop()
    jest.advanceTimersByTime(10_000)
    expect(typingSent(wire.sent)).toEqual([])

    activity(room, 'recordingVoice')
    jest.advanceTimersByTime(299)
    expect(typingSent(wire.sent)).toEqual([])
    jest.advanceTimersByTime(1)
    expect(typingSent(wire.sent)).toEqual(['startActivity:recordingVoice'])
  })

  it('makes typing yield: stopTyping once, no late debounced stop, and typing restarts after', async () => {
    const { room, wire } = await joinedRoom()
    room.typing('start')
    const stop = activity(room, 'choosingEmoji')
    jest.advanceTimersByTime(300)
    expect(typingSent(wire.sent)).toEqual([
      'startTyping',
      'stopTyping',
      'startActivity:choosingEmoji'
    ])

    // An emoji insert fires onUpdate while the picker is open.
    room.typing('start')
    jest.advanceTimersByTime(2000)
    expect(typingSent(wire.sent)).toHaveLength(3)

    stop()
    room.typing('start')
    expect(typingSent(wire.sent).slice(3)).toEqual(['stopActivity:choosingEmoji', 'startTyping'])
  })

  it('resends the start every 3 s, and skips a resend while the tab is hidden', async () => {
    const { room, wire } = await joinedRoom()
    activity(room, 'recordingVoice')
    jest.advanceTimersByTime(300 + 3000)
    expect(typingSent(wire.sent)).toEqual([
      'startActivity:recordingVoice',
      'startActivity:recordingVoice'
    ])

    setHidden(true)
    jest.advanceTimersByTime(3000)
    expect(typingSent(wire.sent)).toHaveLength(2)

    setHidden(false)
    jest.advanceTimersByTime(3000)
    expect(typingSent(wire.sent)).toHaveLength(3)
  })

  it('makes a replaced activity stop a no-op, and stops the keepalive on its own stop', async () => {
    const { room, wire } = await joinedRoom()
    const stopVoice = activity(room, 'recordingVoice')
    const stopEmoji = activity(room, 'choosingEmoji')
    jest.advanceTimersByTime(300)
    stopVoice()
    jest.advanceTimersByTime(3000)
    expect(typingSent(wire.sent)).toEqual([
      'startActivity:choosingEmoji',
      'startActivity:choosingEmoji'
    ])

    stopEmoji()
    stopEmoji()
    jest.advanceTimersByTime(10_000)
    expect(typingSent(wire.sent).slice(2)).toEqual(['stopActivity:choosingEmoji'])
  })
})
