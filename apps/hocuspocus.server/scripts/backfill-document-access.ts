/**
 * Writes a Supabase `document_access` row for every Private document in Prisma (#396).
 * Until it runs, their chat stays open. Dry run by default; `--apply` upserts, so re-runs are safe.
 * Run: bun --env-file=../../.env.local scripts/backfill-document-access.ts [--apply]
 */
import { writeDocumentAccessMirror } from '../src/lib/documentAccessMirror'
import { prisma } from '../src/lib/prisma'

const APPLY = process.argv.includes('--apply')

const rows = await prisma.documentMetadata.findMany({
  where: { isPrivate: true },
  select: { documentId: true, ownerId: true },
  orderBy: { documentId: 'asc' }
})

console.log(`Private documents in Prisma: ${rows.length}`)
for (const row of rows) console.log(`  ${row.documentId} owner=${row.ownerId ?? 'none'}`)

if (!APPLY) {
  console.log('\nDry run. Pass --apply to write the mirror rows.')
  await prisma.$disconnect()
  process.exit(0)
}

let failed = 0
for (const row of rows) {
  try {
    await writeDocumentAccessMirror({
      documentId: row.documentId,
      isPrivate: true,
      ownerId: row.ownerId
    })
  } catch (error) {
    failed++
    console.error(`  failed ${row.documentId}: ${(error as Error).message}`)
  }
}

console.log(`\nWrote ${rows.length - failed} of ${rows.length} mirror rows.`)
await prisma.$disconnect()
process.exit(failed > 0 ? 1 : 0)
