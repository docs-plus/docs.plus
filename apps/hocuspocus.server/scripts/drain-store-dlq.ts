/**
 * Replays store dead-letter entries through the normal save path. Dry-run by default; `--apply`
 * only while the worker consumes, or the replay parks the payload behind a 1 h claim-check key.
 * Run:  bun --env-file=../../.env.local scripts/drain-store-dlq.ts [--apply]
 * Prod: docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production \
 *         exec -w /app/apps/hocuspocus.server hocuspocus-worker \
 *         bun scripts/drain-store-dlq.ts
 */
import { prisma } from '../src/lib/prisma'
import {
  closeQueues,
  drainStoreDeadLetterQueue,
  getStoreQueueOldestWaitingAgeMs
} from '../src/lib/queue'
import { disconnectRedis } from '../src/lib/redis'

const APPLY = process.argv.includes('--apply')

// Read before the drain: with --apply the replayed jobs would otherwise be the
// ones this reports, hiding the stalled worker the operator needs to see.
// Advisory, not enforced — the calibrated threshold lives in hocuspocus.worker.ts
// and a second copy here would be a second place to drift.
const oldestWaitingMs = await getStoreQueueOldestWaitingAgeMs()
const result = await drainStoreDeadLetterQueue({ apply: APPLY })

console.log(`store-documents-dlq depth: ${result.depth}`)
console.log(
  `store-documents oldest waiting: ${oldestWaitingMs === null ? 'nothing waiting' : `${oldestWaitingMs} ms`}`
)
if (result.entries.length === 0) {
  console.log('Nothing parked — the depth alert should clear.')
} else {
  console.log(
    '  document              disposition   payload    head   failed at                reason'
  )
  for (const e of result.entries) {
    const bytes = e.stateBytes === 0 ? '—' : `${e.stateBytes.toLocaleString('en-US')} B`
    const head = e.headVersion === null ? 'none' : `v${e.headVersion}${e.headSupersedes ? '*' : ''}`
    // Collapsed before truncating: a Prisma failureReason spans several lines and
    // would otherwise tear the row apart mid-table.
    const reason = (e.failureReason ?? '—').replace(/\s+/g, ' ').slice(0, 60)
    console.log(
      `  ${e.documentName.padEnd(21)} ${e.disposition.padEnd(13)} ${bytes.padStart(9)}  ` +
        `${head.padStart(5)}  ${(e.failedAt ?? '—').padEnd(24)} ${reason}`
    )
  }
  console.log(
    `\n  replay ${result.replayed} · discard ${result.discarded} · skip (in trash) ${result.skipped}` +
      ` · unresolved ${result.unresolved}`
  )
  if (result.entries.some((e) => e.headSupersedes)) {
    console.log(
      '  head "*" — a newer row landed after the entry failed, so the replay likely mints a'
    )
    console.log(
      '  duplicate version; a duplicate carrying a commitMessage is exempt from the sweep forever.'
    )
  }
  // No rows left is indistinguishable from a first save lost in an outage: the
  // worker's isFirstCreation branch recreates the metadata row and emails.
  if (result.entries.some((e) => e.disposition === 'replay' && e.headVersion === null)) {
    console.log(
      '  head "none" — the replay recreates the document and re-sends the "document created"'
    )
    console.log(
      '  email. Check the entry is not older than the purge retention window before applying.'
    )
  }
  if (result.depth > result.entries.length) {
    console.log(`  ${result.depth - result.entries.length} more parked — re-run to continue.`)
  }
  console.log(
    APPLY
      ? '\nReplayed jobs are queued; the store worker persists them on its normal merge path.'
      : '\nDry run — nothing queued, nothing removed. Re-run with --apply.'
  )
}

await closeQueues()
await prisma.$disconnect()
await disconnectRedis()
process.exit(0)
