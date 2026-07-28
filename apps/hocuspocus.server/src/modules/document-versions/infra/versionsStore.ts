import { Prisma, type PrismaClient } from '@prisma/client'
import * as Y from 'yjs'

import type { MachineVersionTrigger, VersionSnapshot } from '../types'

export interface VersionRow {
  version: number
  commitMessage: string | null
  trigger: string | null
  triggeredBy: string | null
  contributors: string[]
  createdAt: Date
}

export interface VersionPage {
  limit: number
  offset: number
  /** Inclusive `createdAt` bounds; the column is indexed. */
  since?: Date
  until?: Date
}

/**
 * Page and count in one transaction so the total cannot describe a different
 * history than the rows. `version desc` is served by the unique index.
 */
export const listVersionRows = async (
  prisma: PrismaClient,
  documentId: string,
  page: VersionPage
): Promise<{ rows: VersionRow[]; total: number }> => {
  // `total` counts the same window as the page, or paging a time range would
  // report the document's whole history as its length.
  const createdAt =
    page.since || page.until
      ? {
          createdAt: {
            ...(page.since && { gte: page.since }),
            ...(page.until && { lte: page.until })
          }
        }
      : {}
  const where = { documentId, ...createdAt }

  const [rows, total] = await prisma.$transaction([
    prisma.documents.findMany({
      where,
      orderBy: { version: 'desc' },
      skip: page.offset,
      take: page.limit,
      select: {
        version: true,
        commitMessage: true,
        trigger: true,
        triggeredBy: true,
        contributors: true,
        createdAt: true
      }
    }),
    prisma.documents.count({ where })
  ])

  return { rows, total }
}

export const findVersionRow = (
  prisma: PrismaClient,
  documentId: string,
  version: number
): Promise<{ data: Buffer; version: number } | null> =>
  prisma.documents.findFirst({
    where: { documentId, version },
    select: { data: true, version: true }
  }) as Promise<{ data: Buffer; version: number } | null>

/**
 * Both sides in one transaction so a concurrent delete cannot hand back a pair
 * that never coexisted. A null `fromVersion` means "greatest version below the
 * target" — `toVersion - 1` is wrong, non-head deletes leave gaps.
 */
export const findDiffRows = async (
  prisma: PrismaClient,
  documentId: string,
  toVersion: number,
  fromVersion: number | null
): Promise<{ before: VersionSnapshot | null; after: VersionSnapshot | null }> => {
  const [after, before] = await prisma.$transaction([
    prisma.documents.findFirst({
      where: { documentId, version: toVersion },
      select: { version: true, data: true }
    }),
    prisma.documents.findFirst({
      where:
        fromVersion === null
          ? { documentId, version: { lt: toVersion } }
          : { documentId, version: fromVersion },
      orderBy: { version: 'desc' },
      select: { version: true, data: true }
    })
  ])

  return { before, after }
}

export type DeleteVersionOutcome =
  { status: 'deleted' } | { status: 'not-found' } | { status: 'head-conflict' }

/**
 * Non-head only. Deleting the head rewinds the cold-load base, and a hot room
 * would then flush its newer live state back as a phantom revert; the lock
 * makes "is head" and the delete one decision.
 */
export const deleteVersionRow = (
  prisma: PrismaClient,
  documentId: string,
  version: number
): Promise<DeleteVersionOutcome> =>
  prisma.$transaction(async (tx): Promise<DeleteVersionOutcome> => {
    // One statement, so "is head" and the delete share a snapshot. Split across
    // two statements the guard is defeated under READ COMMITTED: a row inserted
    // between them is invisible to the first and deletable by the second.
    const deleted = await tx.$queryRaw<{ version: number }[]>`
      DELETE FROM "Documents"
      WHERE "documentId" = ${documentId}
        AND version = ${version}
        AND version < (SELECT MAX(version) FROM "Documents" WHERE "documentId" = ${documentId})
      RETURNING version
    `
    if (deleted.length > 0) return { status: 'deleted' }

    // Nothing went: either the row is gone or it is the head. Distinguish for
    // the caller — 404 and 409 are different answers.
    const existing = await tx.documents.findFirst({
      where: { documentId, version },
      select: { version: true }
    })
    return existing ? { status: 'head-conflict' } : { status: 'not-found' }
  })

export interface BackupRowParams {
  documentId: string
  /** Metadata already stripped — the row must not carry the live doc's transient keys. */
  snapshot: Buffer<ArrayBuffer>
  name: string
  triggeredBy: string | null
  contributors: string[]
}

export type BackupRowOutcome = { ok: true; version: number } | { ok: false; error: unknown }

/**
 * Merge with the locked head like both persistence paths do — a plain insert of
 * the captured state would clobber an autosave that committed out of order. The
 * version comes out of the closure because the retry re-reads a newer head, so
 * a caller-side `head + 1` would name somebody else's row.
 */
export const appendBackupRow = async (
  prisma: PrismaClient,
  params: BackupRowParams
): Promise<BackupRowOutcome> => {
  const append = (): Promise<number> =>
    prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ version: number; data: Buffer }[]>`
        SELECT version, data FROM "Documents"
        WHERE "documentId" = ${params.documentId}
        ORDER BY version DESC
        LIMIT 1
        FOR UPDATE
      `
      const head = rows[0] ?? null
      // Merge raw, then re-encode. mergeUpdates takes struct content from the
      // older head and only unions delete sets, so a plain merge carries text
      // deleted inside a surviving parent forward — and this row is named, so
      // retention never ages it out. Decoding into a gc:true doc drops it.
      let data = params.snapshot
      if (head) {
        const merged = new Y.Doc()
        Y.applyUpdate(merged, Y.mergeUpdates([new Uint8Array(head.data), new Uint8Array(data)]))
        data = Buffer.from(Y.encodeStateAsUpdate(merged))
      }

      const row = await tx.documents.create({
        data: {
          documentId: params.documentId,
          version: head ? head.version + 1 : 1,
          data,
          commitMessage: params.name,
          // Not 'checkpoint': this copy is minted for a user, not chosen by
          // one, and only the trigger lets retention tell the two apart.
          trigger: 'revert-backup' satisfies MachineVersionTrigger,
          triggeredBy: params.triggeredBy,
          contributors: params.contributors
        },
        select: { version: true }
      })
      return row.version
    })

  try {
    return { ok: true, version: await append() }
  } catch (error) {
    // Re-merge on the (documentId, version) collision, never serve the winner:
    // yielding here would leave the pre-restore state unsaved while the restore
    // still lands, which is the one interleaving that loses a document.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      try {
        return { ok: true, version: await append() }
      } catch (retryError) {
        return { ok: false, error: retryError }
      }
    }
    return { ok: false, error }
  }
}
