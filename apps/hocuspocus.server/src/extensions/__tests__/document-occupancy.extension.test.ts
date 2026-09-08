import { describe, expect, test } from 'bun:test'

import type { OccupancyCandidate } from '../document-occupancy.extension'
import { decideOccupancy } from '../document-occupancy.extension'

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
      lastSeenAt: NOW,
      lastTouchAt: NOW
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
