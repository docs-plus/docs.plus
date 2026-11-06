/**
 * Writes `cardData` for pads the worker has not saved since it learned to. Dry-run by default
 * (counts only); `--apply` writes. A write lands only while the version it read is still the head.
 * Production: a one-off `docker run --rm --memory 768m` container, never `rest-api` or the worker.
 */
import { ydocToPmJson } from '../src/lib/nested-flat-migration'
import { prisma } from '../src/lib/prisma'
import { cardDataFromPmJson } from '../src/modules/social-card/domain/extract'
import { writeCardData } from '../src/modules/social-card/infra/cardDataWrite'

const APPLY = process.argv.includes('--apply')
const BATCH = 50
const PAUSE_MS = 250

const pads = await prisma.documentMetadata.findMany({
  select: { documentId: true, cardData: true },
  orderBy: { id: 'asc' }
})

const counts = {
  pads: pads.length,
  noHead: 0,
  undecodable: 0,
  unchanged: 0,
  toWrite: 0,
  withBlocks: 0,
  withOutline: 0,
  outlineDropped: 0,
  written: 0,
  newerHead: 0
}

for (const [index, { documentId, cardData }] of pads.entries()) {
  // At the top, so a batch of skipped pads still pauses: each one read a full snapshot.
  if (index > 0 && index % BATCH === 0) await Bun.sleep(PAUSE_MS)
  const head = await prisma.documents.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' },
    select: { version: true, data: true }
  })
  if (!head) {
    counts.noHead += 1
    continue
  }

  const decoded = ydocToPmJson(head.data)
  if (!decoded.ok) {
    counts.undecodable += 1
    continue
  }
  const card = cardDataFromPmJson(decoded.json)
  if (card.blocks.length > 0) counts.withBlocks += 1
  if (card.outline) counts.withOutline += 1
  else counts.outlineDropped += 1

  if (Bun.deepEquals(cardData, card)) {
    counts.unchanged += 1
    continue
  }
  counts.toWrite += 1

  if (APPLY) {
    const written = await writeCardData(prisma, documentId, head.version, JSON.stringify(card))
    if (written > 0) counts.written += 1
    else counts.newerHead += 1
  }
}

console.log(APPLY ? 'Applied.' : 'Dry run. Pass --apply to write.')
console.log(counts)
await prisma.$disconnect()
