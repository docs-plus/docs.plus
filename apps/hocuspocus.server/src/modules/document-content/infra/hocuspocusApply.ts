import * as Y from 'yjs'

import { captureUnknown } from '../../../lib/instrument'
import { documentContentApplyTotal } from '../../../lib/metrics'
import type { DocApplyResult } from '../domain/applyContentToDoc'
import { applyContentToDoc } from '../domain/applyContentToDoc'
import {
  encodeContent,
  startsWithTitleHeading,
  TITLE_HEADING_DETAIL
} from '../domain/encodeContent'
import type {
  ApplyContentRequest,
  ApplyContext,
  ApplyOutcome,
  InitWsApplyDeps,
  VersionStamp
} from '../types'
import { COMMIT_POLL_MS, WS_APPLY_DEADLINE_MS } from '../types'
import { findDocumentMeta, findHeadRowAfter, findHeadVersion } from './contentStore'

const METRIC_OUTCOME: Record<ApplyOutcome['status'], string> = {
  applied: 'applied',
  'not-found': 'not_found',
  'invalid-content': 'invalid_content',
  conflict: 'conflict',
  'open-failed': 'error',
  'persist-failed': 'error',
  busy: 'busy',
  'not-confirmed': 'not_confirmed'
}

const MAX_PENDING_COMMITS = 1000
const PENDING_MAX_AGE_MS = 5 * 60_000

const stampVersion = (context: ApplyContext, version: VersionStamp): void => {
  if (version.name) context.versionName = version.name
  context.versionTrigger = version.trigger
  context.versionTriggeredBy = version.triggeredBy
  if (version.forceKey) context.versionForceKey = version.forceKey
}

/**
 * Deliberately asymmetric. A live edit landing between this flush and the
 * disconnect flush must mint an honest unnamed, unattributed row. The name goes
 * but an explicit null stays. Clearing the force key would re-derive the plain
 * job id on that flush and mint a duplicate row.
 */
const consumeVersionStamp = (context: ApplyContext): void => {
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

export type ApplyContent = (request: ApplyContentRequest) => Promise<ApplyOutcome>

/**
 * WS-process applier: the one path where injected content reaches a live Y.Doc.
 * `openDirectConnection` hardcodes an authenticated, writable connection and
 * never runs `onAuthenticate`. Metadata existence and the tombstone are
 * re-checked here, not inherited from the REST pre-check.
 */
export const createApplyContent = (
  deps: Omit<InitWsApplyDeps, 'verifyServiceRole'>
): ApplyContent => {
  const { hocuspocus, prisma, logger } = deps

  // Per-document promise chain. Two applies in one process must never
  // interleave with a commit wait, or the second loads the stale head (#229).
  const lockTails = new Map<string, Promise<void>>()

  // Writes applied but not yet seen in a head row: a held-room write whose holder
  // then left, or a not-confirmed one. A cold open before the commit would load
  // the stale head, so the next apply waits for it first. The age cap keeps a
  // store that failed or was dropped from refusing applies for good.
  const pendingCommits = new Map<string, { after: Map<number, number>; at: number }>()

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

  const applyUnderLock = async (
    request: ApplyContentRequest,
    deadline: number
  ): Promise<ApplyOutcome> => {
    const {
      documentId,
      mode,
      content,
      version,
      sectionId,
      rev,
      from,
      to,
      oldText,
      newText,
      actor
    } = request

    // The hop client gives up at its own timeout. Starting now would write
    // after REST had already reported failure.
    if (Date.now() >= deadline) return { status: 'busy' }

    const meta = await findDocumentMeta(prisma, documentId)
    if (!meta || meta.deletedAt) return { status: 'not-found' }

    // A text edit and a block delete bring no nodes, so there is nothing to encode.
    const encoded =
      content.content.length > 0
        ? encodeContent(content, { requireTitleHeading: mode === 'replace' })
        : { ok: true as const, scratch: new Y.Doc() }
    if (!encoded.ok) return { status: 'invalid-content', detail: encoded.detail }

    // A faithful WS-shaped context, not hygiene. A defensively-rowless first save
    // reads `context.slug` unguarded in the worker, and `{}` would stamp the
    // 19-char documentId into the ops email link. `user` reaches only the
    // worker's new-document email: an actor write credits the actor, never the owner.
    const owner = meta.ownerId ? { sub: meta.ownerId, email: meta.email ?? undefined } : undefined
    const context: ApplyContext = {
      user: actor ?? owner,
      slug: meta.slug,
      documentId,
      deviceType: 'service'
    }

    const pending = pendingCommits.get(documentId)
    if (pending && !hocuspocus.documents.has(documentId)) {
      const fresh = Date.now() - pending.at < PENDING_MAX_AGE_MS
      if (fresh && (await waitForCommit(documentId, 0, pending.after, deadline)) === null) {
        return { status: 'busy' }
      }
      pendingCommits.delete(documentId)
    }

    const headBefore = await findHeadVersion(prisma, documentId)

    let connection: Awaited<ReturnType<typeof hocuspocus.openDirectConnection>>
    try {
      connection = await hocuspocus.openDirectConnection(documentId, context)
    } catch (error) {
      logger.error({ err: error, documentId }, 'Failed to open a direct connection')
      captureUnknown(error, { extra: { documentId } })
      return { status: 'open-failed' }
    }

    const room = connection.document
    // Filled inside the transact callback; an object, so TS does not narrow it to its initial value.
    const run: { result: DocApplyResult; after?: Map<number, number> } = { result: { ok: true } }
    let outcome: ApplyOutcome
    try {
      // Appending into an empty fragment IS the document's first node, so the
      // title-first contract applies there too.
      const fragmentEmpty = (room?.getXmlFragment('default').length ?? 0) === 0
      if (mode === 'append' && fragmentEmpty && !startsWithTitleHeading(content.content)) {
        return { status: 'invalid-content', detail: TITLE_HEADING_DETAIL }
      }

      // Stamped after every refusal known before the transact. `finally`
      // disconnects on every path, and a surviving name would mint a row. A
      // section refusal is known only inside the callback, which clears it there.
      if (version) stampVersion(context, version)

      try {
        await connection.transact((document) => {
          const target =
            sectionId && rev ? { sectionId, rev, from, to, oldText, newText } : undefined
          run.result = applyContentToDoc(document, encoded.scratch, mode, target)
          run.after = Y.decodeStateVector(Y.encodeStateVector(document))
          // The flush that runs next must not mint a named row for a write that
          // never happened.
          if (!run.result.ok && version) {
            consumeVersionStamp(context)
            delete context.versionForceKey
          }
        })
      } finally {
        // Consume on the rejection path too. The `finally` disconnect below
        // re-runs the store hooks against this same context object. A surviving
        // stamp mints a named row for an apply that 500'd.
        if (version) consumeVersionStamp(context)
      }
      outcome = run.result.ok
        ? { status: 'applied', ...(run.result.rev ? { rev: run.result.rev } : {}) }
        : { status: run.result.status, detail: run.result.detail }
    } catch (error) {
      logger.error({ err: error, documentId, mode }, 'Content apply transact rejected')
      captureUnknown(error, { extra: { documentId, mode } })
      return { status: 'persist-failed' }
    } finally {
      // A rejected store leaves the debouncer's execution uncleared, so
      // disconnect() rejects too. A bare await would swap the crafted
      // persist-failed 500 for a generic onError 500 plus Sentry noise.
      await connection
        .disconnect()
        .catch((error) => logger.error({ err: error, documentId }, 'Disconnect after apply failed'))
    }

    // Wait only when this apply's disconnect unloaded the room. A held room
    // never reloads from the stale head.
    const unloaded = hocuspocus.documents.get(documentId) !== room
    const { after } = run
    if (outcome.status !== 'applied' || !after) return outcome
    if (!unloaded) {
      recordPending(documentId, after)
      return outcome
    }

    const committed = await waitForCommit(documentId, headBefore, after, deadline)
    if (committed === null) {
      recordPending(documentId, after)
      return { status: 'not-confirmed' }
    }
    pendingCommits.delete(documentId)
    return { ...outcome, version: committed }
  }

  return async (request) => {
    const startedAt = Date.now()
    const { documentId, mode, requestId, payloadBytes } = request

    const outcome = await withDocumentLock(documentId, () =>
      applyUnderLock(request, startedAt + WS_APPLY_DEADLINE_MS)
    )

    documentContentApplyTotal.inc({ mode, outcome: METRIC_OUTCOME[outcome.status] })
    const line = {
      documentId,
      mode,
      outcome: outcome.status,
      durationMs: Date.now() - startedAt,
      payloadBytes,
      requestId
    }
    if (
      outcome.status === 'persist-failed' ||
      outcome.status === 'open-failed' ||
      outcome.status === 'not-confirmed'
    )
      logger.error(line, 'Content apply failed')
    else logger.info(line, 'Content apply')
    return outcome
  }
}
