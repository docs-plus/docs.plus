/**
 * Replays email dead-letter entries through the normal queue. Dry run by default; `--apply` acts.
 * Run:  bun --env-file=../../.env.local scripts/drain-email-dlq.ts [--apply]
 * Prod: docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production \
 *         exec -w /app/apps/hocuspocus.server hocuspocus-worker bun scripts/drain-email-dlq.ts
 */
import { closeEmailQueue, drainEmailDeadLetterQueue } from '../src/lib/email/queue'
import { disconnectRedis } from '../src/lib/redis'

const APPLY = process.argv.includes('--apply')

const result = await drainEmailDeadLetterQueue({ apply: APPLY })

console.log(`email-notifications-dlq depth: ${result.depth}`)
for (const e of result.entries) {
  console.log(`  ${e.id.padEnd(40)} ${(e.failureKind ?? '—').padEnd(10)} ${e.disposition}`)
}
const rest = result.depth - result.entries.length
if (rest > 0) {
  // Unresolved entries stay, so a pass that removed nothing reads the same window again.
  const stuck = result.entries.every((e) => e.disposition === 'unresolved')
  console.log(
    stuck
      ? `  ${rest} more parked behind unresolved entries — remove those first.`
      : `  ${rest} more parked — re-run to continue.`
  )
}
console.log(
  APPLY
    ? '\nReplays are queued and discards removed. Unresolved entries stay for an operator.'
    : '\nDry run — nothing queued, nothing removed. Re-run with --apply.'
)

await closeEmailQueue()
await disconnectRedis()
process.exit(0)
