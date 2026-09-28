import { describe, expect, test } from 'bun:test'

import type { OccupancyCandidate, ReadingState } from '../document-occupancy.extension'
import {
  advanceReading,
  decideOccupancy,
  READ_DWELL_MS,
  readingVisibility
} from '../document-occupancy.extension'

const NOW = 1_757_000_000_000
const OWNER = '83bac16e-8ba7-4c1c-88c0-6e0a024b52c7'
const SOCKET = '0f868b6c-cd9d-41ec-aff7-48f40f5efc38'
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'

// A signed-in browser socket. Every refusal below changes exactly one fact.
const candidate = (overrides: Partial<OccupancyCandidate> = {}): OccupancyCandidate => ({
  context: { user: { sub: OWNER } },
  requestHeaders: { 'user-agent': BROWSER_UA },
  socketId: SOCKET,
  ...overrides
})

// Get one gate wrong and the server stamps Last left for somebody who never
// left, which shifts their next History compare and their next digest window.
describe('decideOccupancy', () => {
  test('CONTROL a signed-in browser socket becomes an occupant', () => {
    expect(decideOccupancy(candidate(), NOW)).toEqual({
      userId: OWNER,
      member: `${OWNER}:${SOCKET}`,
      lastTouchAt: NOW,
      visibleSince: NOW,
      readAt: null
    })
  })

  test('refuses a bot, and a request carrying no user agent at all', () => {
    const bot = {
      'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    }
    expect(decideOccupancy(candidate({ requestHeaders: bot }), NOW)).toBeNull()
    expect(decideOccupancy(candidate({ requestHeaders: {} }), NOW)).toBeNull()
  })

  test('refuses the internal direct connection, which carries the owner id', () => {
    // `openDirectConnection` fabricates `user.sub` as the document owner and
    // never fires `connected`. Admitting it here stamps a leave for the owner.
    expect(decideOccupancy(candidate({ socketId: 'server' }), NOW)).toBeNull()
  })

  test('refuses a service device', () => {
    expect(
      decideOccupancy(candidate({ context: { deviceType: 'service', user: { sub: OWNER } } }), NOW)
    ).toBeNull()
  })

  test('refuses a connection with no identity', () => {
    expect(decideOccupancy(candidate({ context: {} }), NOW)).toBeNull()
    expect(decideOccupancy(candidate({ context: { user: { sub: '' } } }), NOW)).toBeNull()
    expect(decideOccupancy(candidate({ context: { user: { sub: 42 } } }), NOW)).toBeNull()
  })

  test('refuses an anonymous user', () => {
    expect(
      decideOccupancy(candidate({ context: { user: { sub: OWNER, is_anonymous: true } } }), NOW)
    ).toBeNull()
  })
})

// Last left bounds the reader's next digest. Moving it past changes they never
// saw drops those changes from the mail for good.
describe('advanceReading', () => {
  const SEC = 1000
  const opened: ReadingState = { visibleSince: NOW, readAt: null }
  const run = (steps: [Parameters<typeof advanceReading>[1], number][], start = opened) =>
    steps.reduce((state, [event, at]) => advanceReading(state, event, NOW + at), start)

  test('CONTROL a visible tab counts once it has been seen for the dwell', () => {
    expect(run([['heard', READ_DWELL_MS]]).readAt).toBe(NOW + READ_DWELL_MS)
  })

  test('a quick open and close reads nothing', () => {
    expect(run([['heard', 5 * SEC]]).readAt).toBeNull()
  })

  test('a hidden tab that stays open for hours keeps the moment it was hidden', () => {
    const state = run([
      ['heard', 30 * SEC],
      ['hidden', 60 * SEC],
      ['heard', 3 * 60 * 60 * SEC]
    ])
    expect(state.readAt).toBe(NOW + 60 * SEC)
  })

  test('a quick glance back at a hidden tab does not move the reading mark', () => {
    const state = run([
      ['hidden', 60 * SEC],
      ['visible', 2 * 60 * 60 * SEC],
      ['heard', 2 * 60 * 60 * SEC + 3 * SEC]
    ])
    expect(state.readAt).toBe(NOW + 60 * SEC)
  })

  test('a tab opened in the background reads nothing until it has been seen', () => {
    const state = run(
      [
        ['heard', 60 * 60 * SEC],
        ['visible', 2 * 60 * 60 * SEC],
        ['heard', 2 * 60 * 60 * SEC + 4 * SEC]
      ],
      { visibleSince: null, readAt: null }
    )
    expect(state.readAt).toBeNull()
  })
})

describe('decideOccupancy — a report that landed before connected', () => {
  test('a hidden report seeds a hidden tab', () => {
    const hidden = decideOccupancy(
      candidate({ context: { user: { sub: OWNER }, reportedVisible: false } }),
      NOW
    )
    expect(hidden?.visibleSince).toBeNull()
  })

  test('CONTROL a visible report, or none, seeds a visible tab', () => {
    const seen = decideOccupancy(
      candidate({ context: { user: { sub: OWNER }, reportedVisible: true } }),
      NOW
    )
    expect(seen?.visibleSince).toBe(NOW)
    expect(decideOccupancy(candidate(), NOW)?.visibleSince).toBe(NOW)
  })
})

describe('readingVisibility', () => {
  test('reads the flag of a reading message and nothing else', () => {
    expect(readingVisibility('{"msg":"reading","visible":false}')).toBe(false)
    expect(readingVisibility('{"msg":"reading","visible":true}')).toBe(true)
    expect(readingVisibility('{"msg":"reading","visible":"no"}')).toBeNull()
    expect(readingVisibility('{"type":"docTitle"}')).toBeNull()
    expect(readingVisibility('not json')).toBeNull()
  })
})
