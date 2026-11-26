/**
 * One-off backfill for #738: clears live `@tiptap/y-tiptap` position-migration maps
 * from head rows in `"Documents"` without rebuilding any Y.Doc.
 *
 * - Dry run by default (prints counts only; writes nothing).
 * - `--apply` backs up original bytes to `"_backfill_738_backup"` and updates `"Documents"`.
 * - `--doc <documentId>` restricts the run to one document (for scratch testing first).
 * - `--restore <rowId>` restores one row's original bytes from `"_backfill_738_backup"`.
 *
 * Live rooms are guarded via Redis `PUBSUB NUMSUB hocuspocus:<documentId>` (never
 * `doc-occupancy:*`). Every write takes `pg_advisory_xact_lock(hashtext('doc-store:' || id))`.
 *
 * Run:
 *   bun --env-file=../../.env.local scripts/backfill-clear-migration-maps.ts [--doc <id>] [--apply]
 *   bun --env-file=../../.env.local scripts/backfill-clear-migration-maps.ts --restore <rowId>
 */
import { parseArgs } from 'node:util'

import * as Y from 'yjs'

import { lockDocumentStore } from '../src/lib/lockDocumentStore'
import { ydocToPmJson } from '../src/lib/nested-flat-migration'
import { prisma } from '../src/lib/prisma'
import { createRedisConnection, waitForRedisReady } from '../src/lib/redis'
import { POSITION_MIGRATIONS_PREFIX, stripSnapshotMetadata } from '../src/lib/snapshotMetadata'
import type { RedisClient } from '../src/types'

const BACKUP_TABLE = '_backfill_738_backup'
const TRANSFERS_MARKER = Buffer.from('\x09transfers', 'binary')
const PREFIX_MARKER = Buffer.from(POSITION_MIGRATIONS_PREFIX, 'utf8')
const TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 }

interface CandidateHead {
  id: number
  documentId: string
  version: number
}

interface HeadRow extends CandidateHead {
  data: Buffer
}

interface BackupRow {
  row_id: number
  document_id: string
  version: number
  original_data: Buffer
}

type ProcessOutcome =
  | { status: 'already-clean' }
  | { status: 'skipped-live' }
  | { status: 'refused' }
  | { status: 'eligible' | 'cleared'; bytesBefore: number; bytesAfter: number }

const { values: cli } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    doc: { type: 'string' },
    restore: { type: 'string' }
  },
  strict: true
})

const APPLY = cli.apply
const DOC_FILTER = cli.doc?.trim() || null
const RESTORE_RAW = cli.restore?.trim() || null

const countLivePositionMigrations = (data: Uint8Array): number => {
  const ydoc = new Y.Doc()
  try {
    Y.applyUpdate(ydoc, data instanceof Buffer ? new Uint8Array(data) : data)
    let total = 0
    for (const key of [...ydoc.share.keys()]) {
      if (key.startsWith(POSITION_MIGRATIONS_PREFIX)) {
        total += ydoc.getMap(key).size
      }
    }
    return total
  } finally {
    ydoc.destroy()
  }
}

const stateVectorOf = (data: Uint8Array): Buffer => {
  const ydoc = new Y.Doc()
  try {
    Y.applyUpdate(ydoc, data instanceof Buffer ? new Uint8Array(data) : data)
    return Buffer.from(Y.encodeStateVector(ydoc))
  } finally {
    ydoc.destroy()
  }
}

/**
 * Checks whether any Hocuspocus WS replica currently holds the room open via
 * `@hocuspocus/extension-redis` pub/sub. Never reads `doc-occupancy:*`.
 */
const isRoomLive = async (redis: RedisClient, documentId: string): Promise<boolean> => {
  const channel = `hocuspocus:${documentId}`
  const reply = (await redis.pubsub('NUMSUB', channel)) as [string, number | string]
  const count = Number(reply?.[1] ?? 0)
  if (!Number.isFinite(count)) {
    throw new Error(`Unexpected PUBSUB NUMSUB reply for channel ${channel}`)
  }
  return count > 0
}

const ensureBackupTable = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${BACKUP_TABLE}" (
      row_id integer PRIMARY KEY,
      document_id text NOT NULL,
      version integer NOT NULL,
      original_data bytea NOT NULL,
      backed_up_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

const planStrip = (
  data: Buffer
):
  | { ok: true; stripped: Buffer<ArrayBuffer>; bytesBefore: number; bytesAfter: number }
  | { ok: false; reason: 'already-clean' | 'refused' } => {
  let liveBefore: number
  try {
    liveBefore = countLivePositionMigrations(data)
  } catch {
    return { ok: false, reason: 'refused' }
  }
  if (liveBefore === 0) return { ok: false, reason: 'already-clean' }

  const beforePm = ydocToPmJson(data)
  if (!beforePm.ok) return { ok: false, reason: 'refused' }

  let stripped: Buffer<ArrayBuffer>
  try {
    stripped = stripSnapshotMetadata(data)
  } catch {
    return { ok: false, reason: 'refused' }
  }

  let liveAfter: number
  try {
    liveAfter = countLivePositionMigrations(stripped)
    if (!stateVectorOf(data).equals(stateVectorOf(stripped))) {
      return { ok: false, reason: 'refused' }
    }
  } catch {
    return { ok: false, reason: 'refused' }
  }
  if (liveAfter !== 0) return { ok: false, reason: 'refused' }

  const afterPm = ydocToPmJson(stripped)
  if (!afterPm.ok) return { ok: false, reason: 'refused' }

  if (JSON.stringify(beforePm.json) !== JSON.stringify(afterPm.json)) {
    return { ok: false, reason: 'refused' }
  }

  return {
    ok: true,
    stripped,
    bytesBefore: data.byteLength,
    bytesAfter: stripped.byteLength
  }
}

const findCandidateHeads = async (docFilter: string | null): Promise<CandidateHead[]> => {
  if (docFilter) {
    return prisma.$queryRaw<CandidateHead[]>`
      WITH heads AS (
        SELECT DISTINCT ON ("documentId") id, "documentId", version, data
        FROM "Documents"
        WHERE "documentId" = ${docFilter}
        ORDER BY "documentId", version DESC
      )
      SELECT id, "documentId", version
      FROM heads
      WHERE position(${TRANSFERS_MARKER} in data) > 0
         OR position(${PREFIX_MARKER} in data) > 0
      ORDER BY "documentId"
    `
  }

  return prisma.$queryRaw<CandidateHead[]>`
    WITH heads AS (
      SELECT DISTINCT ON ("documentId") id, "documentId", version, data
      FROM "Documents"
      ORDER BY "documentId", version DESC
    )
    SELECT id, "documentId", version
    FROM heads
    WHERE position(${TRANSFERS_MARKER} in data) > 0
       OR position(${PREFIX_MARKER} in data) > 0
    ORDER BY "documentId"
  `
}

const runRestore = async (redis: RedisClient, rowId: number): Promise<number> => {
  const backups = await prisma.$queryRaw<BackupRow[]>`
    SELECT row_id, document_id, version, original_data
    FROM "_backfill_738_backup"
    WHERE row_id = ${rowId}
  `
  const backup = backups[0]
  if (!backup) {
    console.error(`restore failed: row_id ${rowId} not found in ${BACKUP_TABLE}`)
    return 1
  }

  if (await isRoomLive(redis, backup.document_id)) {
    console.log('mode: restore')
    console.log('rows read: 1')
    console.log('rows restored: 0')
    console.log('rows skipped as live: 1')
    console.log('rows refused: 0')
    return 1
  }

  const outcome = await prisma.$transaction(async (tx) => {
    await lockDocumentStore(tx, backup.document_id)

    if (await isRoomLive(redis, backup.document_id)) {
      return 'skipped-live' as const
    }

    const existing = await tx.$queryRaw<{ id: number }[]>`
      SELECT id
      FROM "Documents"
      WHERE id = ${rowId}
      FOR UPDATE
    `
    if (existing.length === 0) return 'not-found' as const

    const originalBytes = Buffer.from(backup.original_data)
    await tx.$executeRaw`
      UPDATE "Documents"
      SET data = ${originalBytes}
      WHERE id = ${rowId}
    `
    return 'restored' as const
  }, TX_OPTIONS)

  console.log('mode: restore')
  console.log(`row id: ${rowId}`)
  console.log(`backup table: ${BACKUP_TABLE}`)
  console.log('rows read: 1')
  console.log(`rows restored: ${outcome === 'restored' ? 1 : 0}`)
  console.log(`rows skipped as live: ${outcome === 'skipped-live' ? 1 : 0}`)
  console.log(`rows refused: ${outcome === 'not-found' ? 1 : 0}`)
  if (outcome === 'restored') {
    console.log(`bytes restored: ${backup.original_data.byteLength}`)
  }
  return outcome === 'restored' ? 0 : 1
}

const processCandidateDryRun = async (
  redis: RedisClient,
  candidate: CandidateHead
): Promise<ProcessOutcome> => {
  if (await isRoomLive(redis, candidate.documentId)) {
    return { status: 'skipped-live' }
  }

  const rows = await prisma.$queryRaw<HeadRow[]>`
    SELECT id, "documentId", version, data
    FROM "Documents"
    WHERE "documentId" = ${candidate.documentId}
    ORDER BY version DESC
    LIMIT 1
  `
  const head = rows[0]
  if (!head) return { status: 'already-clean' }

  const planned = planStrip(head.data)
  if (!planned.ok) return { status: planned.reason }

  return {
    status: 'eligible',
    bytesBefore: planned.bytesBefore,
    bytesAfter: planned.bytesAfter
  }
}

const processCandidateApply = async (
  redis: RedisClient,
  candidate: CandidateHead
): Promise<ProcessOutcome> => {
  if (await isRoomLive(redis, candidate.documentId)) {
    return { status: 'skipped-live' }
  }

  return prisma.$transaction(async (tx): Promise<ProcessOutcome> => {
    await lockDocumentStore(tx, candidate.documentId)

    // Re-check inside the advisory lock to close the open-room race.
    if (await isRoomLive(redis, candidate.documentId)) {
      return { status: 'skipped-live' }
    }

    const rows = await tx.$queryRaw<HeadRow[]>`
      SELECT id, "documentId", version, data
      FROM "Documents"
      WHERE "documentId" = ${candidate.documentId}
      ORDER BY version DESC
      LIMIT 1
      FOR UPDATE
    `
    const head = rows[0]
    if (!head) return { status: 'already-clean' }

    const planned = planStrip(head.data)
    if (!planned.ok) return { status: planned.reason }

    const originalBytes = Buffer.from(head.data)
    await tx.$executeRaw`
      INSERT INTO "_backfill_738_backup" (row_id, document_id, version, original_data)
      VALUES (${head.id}, ${head.documentId}, ${head.version}, ${originalBytes})
      ON CONFLICT (row_id) DO NOTHING
    `

    await tx.$executeRaw`
      UPDATE "Documents"
      SET data = ${planned.stripped}
      WHERE id = ${head.id}
    `

    return {
      status: 'cleared',
      bytesBefore: planned.bytesBefore,
      bytesAfter: planned.bytesAfter
    }
  }, TX_OPTIONS)
}

const main = async (): Promise<number> => {
  if (APPLY && RESTORE_RAW !== null) {
    console.error('Refusing to run: --apply and --restore cannot be combined.')
    return 1
  }

  let restoreRowId: number | null = null
  if (RESTORE_RAW !== null) {
    if (!/^\d+$/.test(RESTORE_RAW)) {
      console.error(`Refusing to run: invalid --restore rowId "${RESTORE_RAW}"`)
      return 1
    }
    restoreRowId = Number.parseInt(RESTORE_RAW, 10)
    if (!Number.isSafeInteger(restoreRowId) || restoreRowId <= 0) {
      console.error(`Refusing to run: invalid --restore rowId "${RESTORE_RAW}"`)
      return 1
    }
  }

  // Fail closed without Redis: live-room guard requires PUBSUB NUMSUB.
  const redis = createRedisConnection()
  if (!redis) {
    console.error('Refusing to run: Redis is required for PUBSUB NUMSUB live-room checks.')
    return 1
  }

  try {
    const ready = await waitForRedisReady(redis)
    if (!ready) {
      console.error('Refusing to run: Redis connection did not become ready.')
      return 1
    }

    if (restoreRowId !== null) {
      return await runRestore(redis, restoreRowId)
    }

    if (APPLY) {
      await ensureBackupTable()
    }

    const candidates = await findCandidateHeads(DOC_FILTER)

    let rowsRead = 0
    let rowsEligible = 0
    let rowsCleared = 0
    let rowsSkippedAsLive = 0
    let rowsRefused = 0
    let bytesBefore = 0
    let bytesAfter = 0

    for (const candidate of candidates) {
      rowsRead += 1
      const outcome = APPLY
        ? await processCandidateApply(redis, candidate)
        : await processCandidateDryRun(redis, candidate)

      switch (outcome.status) {
        case 'already-clean':
          break
        case 'skipped-live':
          rowsSkippedAsLive += 1
          break
        case 'refused':
          rowsRefused += 1
          break
        case 'eligible':
          rowsEligible += 1
          bytesBefore += outcome.bytesBefore
          bytesAfter += outcome.bytesAfter
          break
        case 'cleared':
          rowsCleared += 1
          bytesBefore += outcome.bytesBefore
          bytesAfter += outcome.bytesAfter
          break
      }
    }

    const bytesSaved = Math.max(0, bytesBefore - bytesAfter)
    console.log(`mode: ${APPLY ? 'apply' : 'dry-run'}`)
    console.log(`rows read: ${rowsRead}`)
    if (!APPLY) {
      console.log(`rows eligible to clear: ${rowsEligible}`)
    }
    console.log(`rows cleared: ${rowsCleared}`)
    console.log(`rows skipped as live: ${rowsSkippedAsLive}`)
    console.log(`rows refused: ${rowsRefused}`)
    console.log(`bytes before: ${bytesBefore}`)
    console.log(`bytes after: ${bytesAfter}`)
    console.log(`bytes saved: ${bytesSaved}`)
    console.log(`backup table: ${BACKUP_TABLE}`)
    console.log(
      'restore hint: bun --env-file=../../.env.local scripts/backfill-clear-migration-maps.ts --restore <rowId>'
    )

    return rowsRefused > 0 ? 1 : 0
  } finally {
    try {
      await redis.quit()
    } catch {
      redis.disconnect()
    }
    await prisma.$disconnect()
  }
}

const exitCode = await main()
process.exit(exitCode)
