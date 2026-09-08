/**
 * Live presence per document, shared across the fleet. The fan-out reads it to
 * mute people who are still in the room. The disconnect path reads it to decide
 * whether a person's last socket on that document has gone.
 */

import type { ChainableCommander } from 'ioredis'

import type { RedisClient } from '../types/redis.types'
import { logger } from './logger'
import { documentOccupancyReadsTotal, documentOccupancyWritesTotal } from './metrics'
import { getRedisClient } from './redis'

const occupancyLogger = logger.child({ service: 'document-occupancy' })

/** The client renews awareness every 15 s, so this tolerates two missed renewals. */
export const OCCUPANT_STALE_MS = 45_000

/** Throttle: at most one Redis write per socket per window. */
export const OCCUPANCY_TOUCH_MS = 10_000

/**
 * Same budget as `consumeWithin`. REDIS_COMMAND_TIMEOUT defaults to 60000 and
 * `enableOfflineQueue` is true, so an unbounded call can hang for a minute.
 */
export const OCCUPANCY_TIMEOUT_MS = 500

/** An empty room must not leak its key forever. */
export const OCCUPANCY_TTL_S = 3600

/** documentId is the raw room name. A lowercased key reads an empty set. */
export const occupancyKey = (documentId: string): string => `doc-occupancy:${documentId}`

/** A socket, not a person: two tabs are two members under one user id. */
export const occupancyMember = (userId: string, socketId: string): string => `${userId}:${socketId}`

/** The only reader of the format above. The socket id is the tail, colons and all. */
const occupantUserIds = (members: string[]): Set<string> => {
  const userIds = new Set<string>()
  for (const member of members) {
    const at = member.indexOf(':')
    if (at > 0) userIds.add(member.slice(0, at))
  }
  return userIds
}

export type OccupancyOutcome = 'ok' | 'timeout' | 'error' | 'no-client'

const TIMED_OUT = Symbol('document-occupancy-timed-out')

/** MULTI reports a per-command fault inside the reply, never by rejecting. */
const throwOnReplyError = (replies: [Error | null, unknown][] | null): void => {
  for (const [err] of replies ?? []) if (err) throw err
}

/**
 * Prunes the stale, then lists the survivors. The members come from the LAST
 * reply, so a caller may queue its own commands on the chain first.
 */
const pruneAndListMembers = async (
  chain: ChainableCommander,
  key: string,
  cutoffMs: number
): Promise<string[]> => {
  const replies = await chain
    .zremrangebyscore(key, '-inf', `(${cutoffMs}`)
    .zrange(key, '0', '-1')
    .exec()
  throwOnReplyError(replies)
  const members = replies?.at(-1)?.[1]
  return Array.isArray(members) ? (members as string[]) : []
}

/**
 * Never rejects and never waits past the budget, so a caller may fire it
 * detached. Shaped on `consumeWithin`: Promise.race already handles a late
 * rejection, so only the timer needs clearing.
 */
const withinBudget = async <T>(
  op: string,
  run: (client: RedisClient) => Promise<T>
): Promise<{ outcome: OccupancyOutcome; value: T | null }> => {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const client = getRedisClient()
    if (!client) return { outcome: 'no-client', value: null }

    const raced = await Promise.race([
      run(client),
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), OCCUPANCY_TIMEOUT_MS)
      })
    ])

    if (raced === TIMED_OUT) return { outcome: 'timeout', value: null }
    return { outcome: 'ok', value: raced }
  } catch (err) {
    occupancyLogger.warn({ err, op }, 'Occupancy Redis call failed')
    return { outcome: 'error', value: null }
  } finally {
    clearTimeout(timer)
  }
}

/** Registers or refreshes one socket at `atMs`, the last instant it was heard from. */
export const touchOccupant = async (
  documentId: string,
  member: string,
  atMs: number,
  op: 'register' | 'refresh'
): Promise<OccupancyOutcome> => {
  const key = occupancyKey(documentId)
  const { outcome } = await withinBudget(op, async (client) => {
    const replies = await client.multi().zadd(key, atMs, member).expire(key, OCCUPANCY_TTL_S).exec()
    throwOnReplyError(replies)
  })
  documentOccupancyWritesTotal.inc({ op, outcome })
  return outcome
}

export interface OccupancyRelease {
  /** True when no other live socket of this user remains on the document. */
  lastOccupantGone: boolean
  outcome: OccupancyOutcome
}

/**
 * Drops this socket, then reports whether the person still holds another one.
 * The stale prune runs here too, so one crashed replica's leftover member cannot
 * suppress a real Last left until some later fan-out happens to clear it.
 */
export const releaseOccupant = async (
  documentId: string,
  userId: string,
  member: string,
  nowMs: number
): Promise<OccupancyRelease> => {
  const key = occupancyKey(documentId)
  const cutoff = nowMs - OCCUPANT_STALE_MS

  const { outcome, value } = await withinBudget('release', (client) =>
    pruneAndListMembers(client.multi().zrem(key, member), key, cutoff)
  )

  documentOccupancyWritesTotal.inc({ op: 'release', outcome })

  // A verdict we could not read is safe to take as "gone". The column is
  // monotone, so a tab that really survived supersedes it on its own disconnect.
  if (outcome !== 'ok' || !value) return { lastOccupantGone: true, outcome }

  return { lastOccupantGone: !occupantUserIds(value).has(userId), outcome }
}

export interface OccupancyRead {
  userIds: string[]
  outcome: OccupancyOutcome | 'empty'
}

/**
 * Live user ids on a document, after pruning the dead. Every degraded arm, and
 * an empty key alike, return no ids — so the caller notifies rather than mutes.
 */
export const readOccupantUserIds = async (
  documentId: string,
  nowMs: number
): Promise<OccupancyRead> => {
  const key = occupancyKey(documentId)
  const cutoff = nowMs - OCCUPANT_STALE_MS

  const { outcome, value } = await withinBudget('read', (client) =>
    pruneAndListMembers(client.multi(), key, cutoff)
  )

  if (outcome !== 'ok' || !value || value.length === 0) {
    // A key that expired under OCCUPANCY_TTL_S and a genuinely empty room are
    // one and the same read. Both mean "nobody is present", which is the side
    // that notifies, so a later reader must never turn `empty` into an error.
    const readOutcome: OccupancyRead['outcome'] = outcome === 'ok' ? 'empty' : outcome
    documentOccupancyReadsTotal.inc({ outcome: readOutcome })
    return { userIds: [], outcome: readOutcome }
  }

  documentOccupancyReadsTotal.inc({ outcome: 'ok' })
  return { userIds: [...occupantUserIds(value)], outcome: 'ok' }
}
