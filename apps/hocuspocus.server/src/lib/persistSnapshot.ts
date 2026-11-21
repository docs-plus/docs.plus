import * as Y from 'yjs'

import type { Prisma, PrismaClient } from '../generated/prisma/client'
import { MACHINE_VERSION_TRIGGERS } from '../types/versionTrigger'
import { lockDocumentStore } from './lockDocumentStore'
import type { StoreJobPhase } from './metrics'
import { stripSnapshotMetadata } from './snapshotMetadata'

export interface PersistSnapshotHead {
  id: number
  version: number
  data: Uint8Array
  contributors: string[]
  commitMessage: string | null
  trigger: string | null
  createdAt: Date
  hasOlder: boolean
}

export interface SaveFacts {
  skipUnchanged: boolean
  trigger: string | null
  commitMessage: string
  /** The job id carries a `versionForceKey`. */
  forced: boolean
}

export interface PersistSnapshotInput extends SaveFacts {
  documentId: string
  /** Raw state from the store hook, before the merge and the strip. */
  incoming: Uint8Array
  triggeredBy: string | null
  contributors: string[]
  /** Runs inside the transaction when the document has no row yet. Returns the slug it wrote. */
  onFirstSave?: (tx: Prisma.TransactionClient) => Promise<string | undefined>
  /** Each phase may run more than once; the caller sums them. */
  addPhase?: (phase: StoreJobPhase, since: number) => void
}

export type PersistOutcome = 'inserted' | 'unchanged' | 'head-moved'

export interface PersistSnapshotResult {
  outcome: PersistOutcome
  /** The new row's version, or the kept head's version when `unchanged`. */
  version: number
  /** The stored bytes of that row. */
  versionData: Buffer
  previousBytes: number
  isFirst: boolean
  createdSlug?: string
}

const isMachineTrigger = (trigger: string | null): boolean =>
  (MACHINE_VERSION_TRIGGERS as readonly string[]).includes(trigger ?? '')

/**
 * A save that adds nothing keeps the head row instead of minting `version + 1`.
 * Only an unnamed, unforced `websocket` save onto an unnamed, non-machine head
 * that is not the document's first row. Byte equality, never visible text: a
 * deleted and retyped letter changes no text but moves its block's author.
 */
export const isUnchangedSave = (
  save: SaveFacts,
  head: Pick<PersistSnapshotHead, 'data' | 'commitMessage' | 'trigger' | 'hasOlder'> | null,
  merged: Buffer
): boolean =>
  save.skipUnchanged &&
  save.trigger === 'websocket' &&
  !save.commitMessage &&
  !save.forced &&
  head !== null &&
  head.hasOlder &&
  !head.commitMessage &&
  !isMachineTrigger(head.trigger) &&
  merged.equals(head.data)

/** First-seen order, no duplicates, so a skipped save still credits its editors. */
export const unionContributors = (head: string[], incoming: string[]): string[] => [
  ...new Set([...head, ...incoming])
]

const readHead = async (
  tx: Prisma.TransactionClient,
  documentId: string
): Promise<PersistSnapshotHead | null> => {
  // ORDER BY version is served top-1 by the (documentId, version) unique index.
  const rows = await tx.$queryRaw<PersistSnapshotHead[]>`
    SELECT d.id, d.version, d.data, d.contributors, d."commitMessage", d.trigger, d."createdAt",
      EXISTS (
        SELECT 1 FROM "Documents" o
        WHERE o."documentId" = d."documentId" AND o.version < d.version
      ) AS "hasOlder"
    FROM "Documents" d
    WHERE d."documentId" = ${documentId}
    ORDER BY d.version DESC
    LIMIT 1
    FOR UPDATE OF d
  `
  return rows[0] ?? null
}

// The lock serializes every writer that takes it. The guard catches one that does
// not, such as an older image during a rolling deploy.
const keepHead = async (
  tx: Prisma.TransactionClient,
  documentId: string,
  head: PersistSnapshotHead,
  contributors: string[]
): Promise<boolean> => {
  const updated = await tx.$executeRaw`
    UPDATE "Documents" SET contributors = ${contributors}::text[], "updatedAt" = now()
    WHERE id = ${head.id}
      AND NOT EXISTS (
        SELECT 1 FROM "Documents" WHERE "documentId" = ${documentId} AND version > ${head.version}
      )
  `
  return updated > 0
}

/**
 * The one head + 1 write for the worker and the queue-down fallback. Merge raw, then
 * strip the result: the strip's decode is what drops text deleted inside a surviving
 * parent. A guard miss reruns once on the fresh head, then inserts as `head-moved`.
 * It never throws for a retry, because each failed attempt feeds the store alert.
 */
export const persistSnapshot = async (
  prisma: Pick<PrismaClient, '$transaction'>,
  input: PersistSnapshotInput
): Promise<PersistSnapshotResult> => {
  const addPhase = input.addPhase ?? (() => {})
  // head_read starts here, so it holds the pool wait and BEGIN. commit runs from
  // the callback's return to the resolve.
  const started = performance.now()
  let callbackDone = 0
  const result = await prisma.$transaction(
    async (tx) => {
      addPhase('head_read', started)
      const lockStarted = performance.now()
      await lockDocumentStore(tx, input.documentId)
      addPhase('lock_wait', lockStarted)

      let guardMisses = 0
      for (;;) {
        const readStarted = performance.now()
        const head = await readHead(tx, input.documentId)
        addPhase('head_read', readStarted)

        const mergeStarted = performance.now()
        const versionData = head
          ? stripSnapshotMetadata(Y.mergeUpdates([new Uint8Array(head.data), input.incoming]))
          : stripSnapshotMetadata(input.incoming)
        addPhase('merge_strip', mergeStarted)

        // insert also holds the first-save metadata upsert and the kept-head update.
        const writeStarted = performance.now()
        if (head && guardMisses < 2 && isUnchangedSave(input, head, versionData)) {
          const contributors = unionContributors(head.contributors, input.contributors)
          const kept = await keepHead(tx, input.documentId, head, contributors)
          addPhase('insert', writeStarted)
          if (!kept) {
            guardMisses += 1
            continue
          }
          callbackDone = performance.now()
          return {
            outcome: 'unchanged' as const,
            version: head.version,
            versionData: Buffer.from(head.data),
            previousBytes: head.data.byteLength,
            isFirst: false
          }
        }

        const createdSlug = head ? undefined : await input.onFirstSave?.(tx)
        const row = await tx.documents.create({
          data: {
            documentId: input.documentId,
            commitMessage: input.commitMessage,
            version: head ? head.version + 1 : 1,
            data: versionData,
            trigger: input.trigger,
            triggeredBy: input.triggeredBy,
            contributors: input.contributors
          },
          // The full row would send the snapshot back inside the lock.
          select: { version: true }
        })
        addPhase('insert', writeStarted)
        callbackDone = performance.now()
        return {
          outcome: guardMisses > 0 ? ('head-moved' as const) : ('inserted' as const),
          version: row.version,
          versionData,
          previousBytes: head ? head.data.byteLength : 0,
          isFirst: !head,
          createdSlug
        }
      }
    },
    // Under bursts saves queue on the pool and on the lock. Waiting must degrade
    // into latency, not P2028 errors that burn the retry budget.
    { maxWait: 5000, timeout: 15000 }
  )
  addPhase('commit', callbackDone)
  return result
}
