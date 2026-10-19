import type { Hocuspocus } from '@hocuspocus/server'
import type { PrismaClient } from '@prisma/client'
import type { Logger } from 'pino'
import * as Y from 'yjs'

import { captureUnknown } from '../../../lib/instrument'
import type { StoreDocumentContext } from '../../../types'
import type { ApplyActor, NamedVersionStamp, VersionStamp } from '../types'
import { COMMIT_POLL_MS, WS_APPLY_DEADLINE_MS } from '../types'
import { findDocumentMeta, findHeadRowAfter, findHeadVersion } from './contentStore'

/**
 * The DirectConnection context. It extends the shape `store()` reads, so the
 * four `version*` names cannot drift from the hook. Presence is the contract:
 * `versionTriggeredBy: null` credits nobody, an absent key credits `user`.
 */
interface LiveWriteContext extends StoreDocumentContext {
  documentId: string
  deviceType: 'service'
}

type LiveWriteFailure =
  { status: 'not-found' } | { status: 'open-failed' } | { status: 'persist-failed' }

/**
 * `version`: the head row that holds the write, when the wait saw one.
 * `unconfirmed`: the room unloaded and no covering row came before the
 * deadline. The write is recorded as pending, so the next cold write waits.
 */
interface LiveWriteDone<M> {
  status: 'done'
  result: M
  version?: number
  unconfirmed?: true
}

type Step<R> = R | undefined | Promise<R | undefined>

/** A refusal from `check` comes before the stamp, so the disconnect flush stays unnamed. */
interface LiveFlushPlan<R extends { status: string }> {
  stamp: NamedVersionStamp
  check?: (room: Y.Doc) => Step<R>
}

/**
 * Steps run in this order, each at most once: `prepare` (no room yet, writes
 * nothing), `check` (room open, no stamp; it may write outside the room, as
 * the restore backup does), `mutate` (inside the transact).
 * `mutate` returning `ok: false` clears the stamp and the force key.
 */
interface LiveWritePlan<R extends { status: string }, M extends { ok: boolean }> {
  stamp?: VersionStamp
  /** Whom the store credits; absent means the document owner. */
  actor?: ApplyActor
  prepare?: () => Step<R>
  check?: (room: Y.Doc) => Step<R>
  mutate: (doc: Y.Doc) => M
}

export interface LiveWrite {
  /**
   * Holds the per-document lock (#229). On a cold room it first waits for any
   * pending commit; after its own unload it waits for a covering head row.
   * `busy`: the lock or the pending wait outlived the deadline; nothing was written.
   */
  write<R extends { status: string }, M extends { ok: boolean }>(
    documentId: string,
    plan: LiveWritePlan<R, M>
  ): Promise<R | LiveWriteFailure | { status: 'busy' } | LiveWriteDone<M>>
  /**
   * One empty transact that fires a store carrying the stamp. No lock, no
   * wait and no pending record (maintainer ruling, 2026-10-19).
   */
  flush<R extends { status: string }>(
    documentId: string,
    plan: LiveFlushPlan<R>
  ): Promise<R | LiveWriteFailure | { status: 'done' }>
}

const MAX_PENDING_COMMITS = 1000
const PENDING_MAX_AGE_MS = 5 * 60_000

interface PendingCommit {
  after: Map<number, number>
  at: number
}

interface RoomHostState {
  lockTails: Map<string, Promise<void>>
  pendingCommits: Map<string, PendingCommit>
}

// Keyed by the room host, so every writer on one Hocuspocus shares one lock and
// one pending record, and a wiring mistake cannot split them. Per process only:
// it makes no claim about another replica.
const roomHostStates = new WeakMap<Hocuspocus, RoomHostState>()

const roomHostState = (hocuspocus: Hocuspocus): RoomHostState => {
  let state = roomHostStates.get(hocuspocus)
  if (!state) {
    state = { lockTails: new Map(), pendingCommits: new Map() }
    roomHostStates.set(hocuspocus, state)
  }
  return state
}

const stampVersion = (context: LiveWriteContext, stamp: VersionStamp): void => {
  if (stamp.name) context.versionName = stamp.name
  context.versionTrigger = stamp.trigger
  context.versionTriggeredBy = stamp.triggeredBy
  if (stamp.forceKey) context.versionForceKey = stamp.forceKey
}

/**
 * Deliberately asymmetric. A live edit landing between this flush and the
 * disconnect flush must mint an honest unnamed, unattributed row. The name goes
 * but an explicit null stays. Clearing the force key would re-derive the plain
 * job id on that flush and mint a duplicate row.
 */
const consumeVersionStamp = (context: LiveWriteContext): void => {
  delete context.versionName
  delete context.versionTrigger
  context.versionTriggeredBy = null
}

/** True when `head` holds every struct `after` names. The worker's strip keeps clocks. */
const headCovers = (head: Uint8Array, after: Map<number, number>): boolean => {
  const headVector = Y.decodeStateVector(Y.encodeStateVectorFromUpdate(head))
  for (const [client, clock] of after) {
    if ((headVector.get(client) ?? 0) < clock) return false
  }
  return true
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The one path where a write reaches a live Y.Doc through a direct connection.
 * `openDirectConnection` hardcodes an authenticated, writable connection and
 * never runs `onAuthenticate`, so metadata and the tombstone are re-checked here.
 */
export const createLiveWrite = (deps: {
  hocuspocus: Hocuspocus
  prisma: PrismaClient
  logger: Logger
}): LiveWrite => {
  const { hocuspocus, prisma, logger } = deps
  const { lockTails, pendingCommits } = roomHostState(hocuspocus)

  const withDocumentLock = async <T>(documentId: string, run: () => Promise<T>): Promise<T> => {
    const previous = lockTails.get(documentId) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => current)
    lockTails.set(documentId, tail)
    await previous
    try {
      return await run()
    } finally {
      release()
      if (lockTails.get(documentId) === tail) lockTails.delete(documentId)
    }
  }

  /**
   * The unload hands the newest state to the queue alone, and the next open
   * reads Postgres. So wait for a row that holds this write. A newer version
   * alone can be another pending job, which is why the state vector decides.
   */
  const waitForCommit = async (
    documentId: string,
    headBefore: number,
    after: Map<number, number>,
    deadline: number
  ): Promise<number | null> => {
    let seen = headBefore
    for (;;) {
      let row: Awaited<ReturnType<typeof findHeadRowAfter>>
      try {
        row = await findHeadRowAfter(prisma, documentId, seen)
      } catch (error) {
        // The write is already handed to the store path, so this is not a persist failure.
        logger.error({ err: error, documentId }, 'Commit poll failed')
        return null
      }
      if (row) {
        if (headCovers(new Uint8Array(row.data), after)) return row.version
        seen = row.version
      }
      if (Date.now() + COMMIT_POLL_MS > deadline) return null
      await sleep(COMMIT_POLL_MS)
    }
  }

  const recordPending = (documentId: string, after: Map<number, number>): void => {
    pendingCommits.delete(documentId)
    pendingCommits.set(documentId, { after, at: Date.now() })
    // The oldest entry is long committed; dropping it only bounds memory.
    if (pendingCommits.size > MAX_PENDING_COMMITS) {
      pendingCommits.delete(pendingCommits.keys().next().value as string)
    }
  }

  /** `deadline` null is a stamp-only flush: no pending wait, no own wait, no record. */
  const run = async <R extends { status: string }, M extends { ok: boolean }>(
    documentId: string,
    plan: LiveWritePlan<R, M>,
    deadline: number | null
  ): Promise<R | LiveWriteFailure | { status: 'busy' } | LiveWriteDone<M>> => {
    // The hop client gives up at its own timeout. Starting now would write
    // after REST had already reported failure.
    if (deadline !== null && Date.now() >= deadline) return { status: 'busy' }

    const meta = await findDocumentMeta(prisma, documentId)
    if (!meta || meta.deletedAt) return { status: 'not-found' }

    const prepared = await plan.prepare?.()
    if (prepared) return prepared

    // A faithful WS-shaped context, not hygiene. A defensively-rowless first save
    // reads `context.slug` unguarded in the worker, and `{}` would stamp the
    // 19-char documentId into the ops email link. `user` reaches only the
    // worker's new-document email: an actor write credits the actor, never the owner.
    const owner = meta.ownerId ? { sub: meta.ownerId, email: meta.email ?? undefined } : undefined
    const context: LiveWriteContext = {
      user: plan.actor ?? owner,
      slug: meta.slug,
      documentId,
      deviceType: 'service'
    }

    let headBefore = 0
    if (deadline !== null) {
      const pending = pendingCommits.get(documentId)
      if (pending && !hocuspocus.documents.has(documentId)) {
        const fresh = Date.now() - pending.at < PENDING_MAX_AGE_MS
        if (fresh && (await waitForCommit(documentId, 0, pending.after, deadline)) === null) {
          return { status: 'busy' }
        }
        pendingCommits.delete(documentId)
      }
      headBefore = await findHeadVersion(prisma, documentId)
    }

    let connection: Awaited<ReturnType<typeof hocuspocus.openDirectConnection>>
    try {
      connection = await hocuspocus.openDirectConnection(documentId, context)
    } catch (error) {
      logger.error({ err: error, documentId }, 'Failed to open a direct connection')
      captureUnknown(error, { extra: { documentId } })
      return { status: 'open-failed' }
    }

    const room = connection.document
    const { stamp, mutate } = plan
    // Set inside the transact callback, which runs before transact resolves.
    let written!: { result: M; after: Map<number, number> }
    try {
      // Unreachable after a successful open; thrown so the catch logs it, as a transact would.
      if (!room) throw new Error('direct connection has no document')
      const checked = await plan.check?.(room)
      if (checked) return checked

      // Stamped after every refusal known before the transact. `finally`
      // disconnects on every path, and a surviving name would mint a row, which
      // retention never prunes. A mutate refusal is known only inside the callback.
      if (stamp) stampVersion(context, stamp)
      try {
        await connection.transact((document) => {
          written = {
            result: mutate(document),
            after: Y.decodeStateVector(Y.encodeStateVector(document))
          }
          // The flush that runs next must not mint a named row for a write that
          // never happened.
          if (!written.result.ok && stamp) {
            consumeVersionStamp(context)
            delete context.versionForceKey
          }
        })
      } finally {
        // Consume on the rejection path too. The `finally` disconnect below
        // re-runs the store hooks against this same context object. A surviving
        // stamp mints a named, attributed row for a write that 500'd.
        if (stamp) consumeVersionStamp(context)
      }
    } catch (error) {
      logger.error({ err: error, documentId }, 'Live write rejected')
      captureUnknown(error, { extra: { documentId } })
      return { status: 'persist-failed' }
    } finally {
      // A rejected store leaves the debouncer's execution uncleared, so
      // disconnect() rejects too. A bare await would swap the crafted
      // persist-failed 500 for a generic onError 500 plus Sentry noise.
      await connection
        .disconnect()
        .catch((error) =>
          logger.error({ err: error, documentId }, 'Disconnect after a live write failed')
        )
    }

    const { result, after } = written
    const done: LiveWriteDone<M> = { status: 'done', result }
    if (deadline === null || !result.ok) return done

    // Wait only when this write's disconnect unloaded the room. A held room
    // never reloads from the stale head, but a later cold open would.
    if (hocuspocus.documents.get(documentId) === room) {
      recordPending(documentId, after)
      return done
    }
    const committed = await waitForCommit(documentId, headBefore, after, deadline)
    if (committed === null) {
      recordPending(documentId, after)
      return { ...done, unconfirmed: true }
    }
    pendingCommits.delete(documentId)
    return { ...done, version: committed }
  }

  const write = <R extends { status: string }, M extends { ok: boolean }>(
    documentId: string,
    plan: LiveWritePlan<R, M>
  ): Promise<R | LiveWriteFailure | { status: 'busy' } | LiveWriteDone<M>> => {
    // Counted from arrival, before the lock, as the hop timeout is.
    const deadline = Date.now() + WS_APPLY_DEADLINE_MS
    return withDocumentLock(documentId, () => run(documentId, plan, deadline))
  }

  const flush = async <R extends { status: string }>(
    documentId: string,
    plan: LiveFlushPlan<R>
  ): Promise<R | LiveWriteFailure | { status: 'done' }> => {
    const flushed = await run(documentId, { ...plan, mutate: () => ({ ok: true }) }, null)
    if (flushed.status === 'done') return { status: 'done' }
    // No deadline, so `busy` cannot come back from a flush.
    return flushed as R | LiveWriteFailure
  }

  return { write, flush }
}
