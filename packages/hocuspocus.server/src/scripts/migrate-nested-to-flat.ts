#!/usr/bin/env bun
/**
 * Batch migration: nested heading schema → flat heading schema (full document history)
 *
 * Engineering runbook (do not skip):
 * 1. Take a database backup / snapshot before first live run.
 * 2. Run with --dry-run; review counts and failure JSON (should be empty).
 * 3. Run with --doc <one id> on a copy or staging; open the doc in the editor.
 * 4. Run full live migration in a low-traffic window; keep ENABLE_SCHEMA_MIGRATION
 *    on in Hocuspocus until you are confident, as a safety net for stragglers.
 *
 * Strategy (per documentId):
 * - Load every history row (all versions), ascending.
 * - For each row: planRow() decodes Yjs → if nested, flatten → encode → round-trip
 *   decode → assert legacy nodes are gone (post_verify). Skip rows already flat.
 * - If ANY row fails, the entire document is skipped (no partial history).
 * - One interactive transaction per document: UPDATE each row by `id` + `version`
 *   (optimistic lock). No DELETE, no INSERT — version numbers and commit messages
 *   are preserved; only `data` bytes change.
 *
 * Data-loss posture (ProseMirror / Yjs):
 * - No row is written until that row’s new payload passes encode + decode + !isOldSchema.
 * - Refuse zero-length encoded output when input was non-empty.
 * - Failed documents: zero rows updated; re-run after fixing migration schema.
 *
 * Usage:
 *   bun run src/scripts/migrate-nested-to-flat.ts              # migrate all
 *   bun run src/scripts/migrate-nested-to-flat.ts --dry-run    # audit only
 *   bun run src/scripts/migrate-nested-to-flat.ts --doc <id>   # single document
 */

import {
  MIGRATION_TRANSACTION_MAX_WAIT_MS,
  MIGRATION_TRANSACTION_TIMEOUT_MS,
  type MigrationPhase as RowMigrationPhase,
  planRow
} from '../lib/nested-flat-migration'
import { prisma, shutdownDatabase } from '../lib/prisma'

const BATCH_SIZE = 50

type MigrationPhase = RowMigrationPhase | 'load' | 'persist' | 'unexpected'

interface MigrationStats {
  totalDocuments: number
  documentsMigrated: number
  documentsSkipped: number
  rowsMigrated: number
  errors: number
  errorIds: string[]
  failures: MigrationFailure[]
}

interface MigrationFailure {
  documentId: string
  version?: number
  phase: MigrationPhase
  message: string
}

function parseArgs(): { dryRun: boolean; docId: string | null } {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    docId: args.includes('--doc') ? (args[args.indexOf('--doc') + 1] ?? null) : null
  }
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

async function getDocumentIds(docId: string | null): Promise<string[]> {
  if (docId) return [docId]

  const docs = await prisma.documents.findMany({
    distinct: ['documentId'],
    select: { documentId: true }
  })
  return docs.map((d) => d.documentId)
}

function recordFailure(
  failures: MigrationFailure[],
  documentId: string,
  phase: MigrationPhase,
  error: unknown,
  version?: number
): void {
  failures.push({
    documentId,
    version,
    phase,
    message: formatError(error)
  })
  const v = version !== undefined ? ` v${version}` : ''
  console.error(`  [${documentId}]${v} FAILED phase=${phase}: ${formatError(error)}`)
}

async function migrateDocumentHistory(
  documentId: string,
  dryRun: boolean,
  failures: MigrationFailure[]
): Promise<{ outcome: 'migrated' | 'skipped' | 'error'; rows: number }> {
  let rows: { id: number; version: number; data: Uint8Array }[]
  try {
    rows = await prisma.documents.findMany({
      where: { documentId },
      orderBy: { version: 'asc' },
      select: { id: true, version: true, data: true }
    })
  } catch (error) {
    recordFailure(failures, documentId, 'load', error)
    return { outcome: 'error', rows: 0 }
  }

  if (rows.length === 0) {
    return { outcome: 'skipped', rows: 0 }
  }

  const updates: { id: number; version: number; bytes: Uint8Array }[] = []

  try {
    for (const row of rows) {
      const planned = planRow(row.data)
      if (!planned.ok) {
        recordFailure(failures, documentId, planned.phase, planned.error, row.version)
        return { outcome: 'error', rows: 0 }
      }

      if (planned.plan.action === 'update') {
        updates.push({
          id: row.id,
          version: row.version,
          bytes: planned.plan.bytes
        })
      }
    }
  } catch (error) {
    recordFailure(failures, documentId, 'unexpected', error)
    return { outcome: 'error', rows: 0 }
  }

  if (updates.length === 0) {
    return { outcome: 'skipped', rows: 0 }
  }

  if (dryRun) {
    const versions = updates.map((u) => u.version).join(', ')
    console.log(`  [${documentId}] WOULD migrate ${updates.length} row(s), versions: ${versions}`)
    return { outcome: 'migrated', rows: updates.length }
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const u of updates) {
          const result = await tx.documents.updateMany({
            where: { id: u.id, version: u.version },
            data: { data: Buffer.from(u.bytes) }
          })
          if (result.count !== 1) {
            throw new Error(
              `Row id=${u.id} version=${u.version}: expected 1 update, got ${result.count} (concurrent change?)`
            )
          }
        }
      },
      {
        maxWait: MIGRATION_TRANSACTION_MAX_WAIT_MS,
        timeout: MIGRATION_TRANSACTION_TIMEOUT_MS
      }
    )
  } catch (error) {
    recordFailure(failures, documentId, 'persist', error)
    return { outcome: 'error', rows: 0 }
  }

  return { outcome: 'migrated', rows: updates.length }
}

async function main() {
  const { dryRun, docId } = parseArgs()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Schema Migration: Nested → Flat (full history per document)`)
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log(
    `  Safety: plan+post-verify per row → single txn (timeout ${MIGRATION_TRANSACTION_TIMEOUT_MS}ms)`
  )
  if (docId) console.log(`  Target: ${docId}`)
  console.log(`${'='.repeat(60)}\n`)

  const stats: MigrationStats = {
    totalDocuments: 0,
    documentsMigrated: 0,
    documentsSkipped: 0,
    rowsMigrated: 0,
    errors: 0,
    errorIds: [],
    failures: []
  }

  try {
    const documentIds = await getDocumentIds(docId)
    stats.totalDocuments = documentIds.length

    console.log(`Found ${stats.totalDocuments} document(s) to process\n`)

    for (let i = 0; i < documentIds.length; i += BATCH_SIZE) {
      const batch = documentIds.slice(i, i + BATCH_SIZE)

      for (const id of batch) {
        const { outcome, rows } = await migrateDocumentHistory(id, dryRun, stats.failures)

        switch (outcome) {
          case 'migrated':
            stats.documentsMigrated++
            stats.rowsMigrated += rows
            if (!dryRun) {
              console.log(
                `  [${i + batch.indexOf(id) + 1}/${stats.totalDocuments}] ${id}: migrated ${rows} row(s)`
              )
            }
            break
          case 'skipped':
            stats.documentsSkipped++
            break
          case 'error':
            stats.errors++
            stats.errorIds.push(id)
            break
        }
      }

      if (i + BATCH_SIZE < documentIds.length) {
        console.log(
          `  ... processed ${Math.min(i + BATCH_SIZE, stats.totalDocuments)}/${stats.totalDocuments}`
        )
      }
    }
  } finally {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`  Results:`)
    console.log(`    Documents (unique): ${stats.totalDocuments}`)
    console.log(`    Documents migrated: ${stats.documentsMigrated}`)
    console.log(`    Documents skipped:  ${stats.documentsSkipped} (no nested rows)`)
    console.log(`    Rows updated:       ${stats.rowsMigrated}`)
    console.log(`    Errors:             ${stats.errors}`)
    if (stats.errorIds.length > 0) {
      console.log(`    Failed doc IDs:     ${stats.errorIds.join(', ')}`)
    }
    if (stats.failures.length > 0) {
      console.log(`\n  Failure detail (JSON — failed docs unchanged):`)
      console.log(JSON.stringify(stats.failures, null, 2))
    }
    if (dryRun) {
      console.log(`\n  This was a DRY RUN. No changes were written.`)
    }
    console.log(`${'='.repeat(60)}\n`)

    await shutdownDatabase()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
