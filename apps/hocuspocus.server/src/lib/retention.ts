import { Prisma, type PrismaClient } from '@prisma/client'
import type { Logger } from 'pino'

import { MACHINE_VERSION_TRIGGERS } from '../types'

const PRUNE_BATCH_SIZE = 1000
const PRUNE_MAX_BATCHES = 10

/**
 * Injected already bound to its client, so `lib` neither reaches up into
 * `api/services` nor names Supabase. Null when no service-role client exists,
 * and the reaper then skips. The narrow `scope` is deliberate: the reaper
 * structurally cannot reach the permanent-delete arm.
 */
export type PurgeDocumentFootprint = (target: {
  documentId: string
  slug: string
  scope: { retention: Date }
}) => Promise<{ purged: number }>

export interface RetentionDeps {
  prisma: PrismaClient
  purge: PurgeDocumentFootprint | null
  logger: Logger
  autosaveRetentionDays: number
  deleteRetentionDays: number
}

/** A soft-deleted document is reapable once its tombstone predates this. */
export const reapCutoff = (retentionDays: number, now: number = Date.now()): Date =>
  new Date(now - retentionDays * 24 * 60 * 60 * 1000)

/**
 * The three hourly passes, behind one call. They live here rather than in the
 * worker entry point because that file has top-level `await` and `process.exit`,
 * so importing a rule from it boots a worker and no test can reach one.
 */
export const createRetention = (deps: RetentionDeps): { run: () => Promise<void> } => {
  const { prisma, purge, logger } = deps

  const cleanupExpiredLogs = async (): Promise<void> => {
    try {
      const [email, push] = await Promise.all([
        prisma.emailSentLog.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
        prisma.pushSentLog.deleteMany({ where: { expiresAt: { lt: new Date() } } })
      ])
      if (email.count > 0 || push.count > 0) {
        logger.info(
          { emailDeleted: email.count, pushDeleted: push.count },
          '🧹 Cleaned up expired idempotency logs'
        )
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to cleanup expired idempotency logs')
    }
  }

  // Thins old autosave snapshots to one per document per day; each day's newest
  // row always survives. A name a person typed is exempt forever, but the names
  // the server mints for itself are not. So a pre-restore backup older than the
  // window is thinned away, and that restore stops being undoable.
  const pruneAutosaveVersions = async (): Promise<void> => {
    if (deps.autosaveRetentionDays <= 0) return
    try {
      let totalDeleted = 0
      for (let batch = 0; batch < PRUNE_MAX_BATCHES; batch += 1) {
        const deleted = await prisma.$executeRaw`
        DELETE FROM "Documents" WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY "documentId", date_trunc('day', "createdAt")
              ORDER BY version DESC
            ) AS day_rank
            FROM "Documents"
            WHERE ("commitMessage" IS NULL OR "commitMessage" = ''
                   OR "trigger" IN (${Prisma.join(MACHINE_VERSION_TRIGGERS)}))
              AND "createdAt" < now() - ${deps.autosaveRetentionDays} * interval '1 day'
          ) ranked
          WHERE day_rank > 1
          LIMIT ${PRUNE_BATCH_SIZE}
        )`
        totalDeleted += deleted
        if (deleted < PRUNE_BATCH_SIZE) break
      }
      if (totalDeleted > 0) {
        logger.info({ deleted: totalDeleted }, '🧹 Pruned old autosave document versions')
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to prune autosave document versions')
    }
  }

  // The per-document purge is shared with the permanent-delete endpoint. Any
  // step's failure throws and leaves `deletedAt` set, so this pass skips the
  // document and the next pass retries it.
  const reapSoftDeletedDocuments = async (): Promise<void> => {
    if (deps.deleteRetentionDays <= 0) return
    if (!purge) {
      logger.warn('Skipping soft-delete reaper — Supabase service-role client unavailable')
      return
    }
    try {
      let totalPurged = 0
      for (let batch = 0; batch < PRUNE_MAX_BATCHES; batch += 1) {
        const cutoff = reapCutoff(deps.deleteRetentionDays)
        // Oldest tombstones first. A batch that all fails burns this pass and
        // defers the rest to the next run rather than starving them.
        const candidates = await prisma.documentMetadata.findMany({
          where: { deletedAt: { not: null, lt: cutoff } },
          orderBy: { deletedAt: 'asc' },
          select: { documentId: true, slug: true },
          take: PRUNE_BATCH_SIZE
        })
        if (candidates.length === 0) break

        for (const { documentId, slug } of candidates) {
          // Re-assert the tombstone at action time, so a document Undone
          // mid-pass is never purged.
          const fresh = await prisma.documentMetadata.findUnique({
            where: { documentId },
            select: { deletedAt: true }
          })
          if (!fresh?.deletedAt || fresh.deletedAt >= cutoff) continue

          try {
            const { purged } = await purge({ documentId, slug, scope: { retention: cutoff } })
            totalPurged += purged
          } catch (err) {
            logger.warn({ err, documentId }, 'Document purge failed; retry next pass')
            continue
          }
        }

        if (candidates.length < PRUNE_BATCH_SIZE) break
      }
      if (totalPurged > 0) logger.info({ purged: totalPurged }, '🧹 Reaped soft-deleted documents')
    } catch (err) {
      logger.warn({ err }, 'Failed to reap soft-deleted documents')
    }
  }

  return {
    run: async () => {
      await cleanupExpiredLogs()
      await pruneAutosaveVersions()
      await reapSoftDeletedDocuments()
    }
  }
}
