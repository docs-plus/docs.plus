/**
 * Compacts stored version rows that still carry text deleted inside a surviving
 * parent. Dry-run by default; `--apply` writes. Re-runnable — a compacted row
 * re-encodes to identical bytes, so a second pass finds nothing.
 * Run: bun --env-file=../../.env.local scripts/backfill-strip-ghosts.ts [--apply]
 */
import * as Y from 'yjs'

import { prisma } from '../src/lib/prisma'

const APPLY = process.argv.includes('--apply')

interface Row {
  id: number
  documentId: string
  version: number
  commitMessage: string | null
  data: Buffer
}

interface Candidate {
  row: Row
  after: Buffer
  ghostBefore: string[]
  ghostAfter: string[]
  visibleMatches: boolean
  idempotent: boolean
}

// Yjs leaves a shared root generic until a typed getter upgrades it, so name the
// two roots the app defines before reading every root back as JSON.
const visibleState = (update: Uint8Array): string => {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  doc.getXmlFragment('default')
  doc.getMap('metadata')
  const roots: Record<string, unknown> = {}
  for (const [name, type] of doc.share) {
    roots[name] = (type as unknown as { toJSON: () => unknown }).toJSON()
  }
  doc.destroy()
  return JSON.stringify(roots)
}

// Decoding into a gc:true doc swaps deleted items' content for a tombstone, so
// re-encoding drops the prose. mergeUpdates cannot: it unions delete sets but
// keeps the older side's struct content verbatim.
const compact = (update: Uint8Array): Buffer => {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  const out = Buffer.from(Y.encodeStateAsUpdate(doc))
  doc.destroy()
  return out
}

// gc:false preserves deleted items, so this reads back exactly the prose a
// compacted row stops carrying — the evidence that the rewrite is worth doing.
const ghostText = (update: Uint8Array): string[] => {
  const doc = new Y.Doc({ gc: false })
  Y.applyUpdate(doc, update)
  const parts: string[] = []
  for (const structs of doc.store.clients.values()) {
    for (const struct of structs) {
      if (struct instanceof Y.Item && struct.deleted && struct.content instanceof Y.ContentString) {
        parts.push(struct.content.str)
      }
    }
  }
  doc.destroy()
  return parts
}

const ghostLength = (parts: string[]): number => parts.reduce((sum, part) => sum + part.length, 0)
const longestGhost = (parts: string[]): string =>
  parts.reduce((longest, part) => (part.length > longest.length ? part : longest), '')

const md5 = (buf: Buffer): string => new Bun.CryptoHasher('md5').update(buf).digest('hex')

const bytes = (n: number): string => n.toLocaleString('en-US')
const pct = (before: number, after: number): string =>
  `${(((after - before) / before) * 100).toFixed(1)}%`
const preview = (text: string, max = 90): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

const rows = await prisma.$queryRaw<Row[]>`
  SELECT id, "documentId", version, "commitMessage", data
  FROM "Documents"
  ORDER BY "documentId", version
`

const totalBefore = rows.reduce((sum, row) => sum + row.data.byteLength, 0)
console.log(`Scanned "Documents": ${rows.length} rows, ${bytes(totalBefore)} B\n`)

if (rows.length === 0) {
  console.log('Nothing to do.')
  await prisma.$disconnect()
  process.exit(0)
}

let failed = false
const check = (ok: boolean, message: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${message}`)
  if (!ok) failed = true
}

// A comparator that returns the same string for every row would wave through an
// unguarded rewrite, so prove it separates two documents before trusting it.
console.log('Comparator controls')
const distinct = new Set(rows.map((row) => visibleState(row.data)))
check(
  distinct.size > 1,
  `visibleState separates rows (${distinct.size} distinct states across ${rows.length} rows)`
)

const carrying = rows
  .map((row) => ({ row, ghost: ghostText(row.data) }))
  .filter((entry) => entry.ghost.length > 0)
  .sort((a, b) => ghostLength(b.ghost) - ghostLength(a.ghost))

// Zero carriers is the goal state, not a broken run, so this one only reports.
console.log(`  · ${carrying.length} of ${rows.length} rows carry recoverable deleted text`)
if (carrying[0]) {
  const worst = carrying[0]
  const longest = longestGhost(worst.ghost)
  check(
    longest.length > 0 && !visibleState(worst.row.data).includes(longest),
    `worst carrier ${worst.row.documentId} v${worst.row.version} hides ${bytes(ghostLength(worst.ghost))} chars from visible state`
  )
  console.log(`    sample: "${preview(worst.ghost.join(''))}"`)
}
console.log()

const candidates: Candidate[] = []
for (const row of rows) {
  const after = compact(row.data)
  const ghostBefore = ghostText(row.data)
  // Erasure, not size, is the reason to rewrite: a carrier whose re-encode is
  // byte-neutral still hands its deleted prose to every future dump.
  if (after.equals(row.data)) continue
  if (after.byteLength >= row.data.byteLength && ghostBefore.length === 0) continue
  candidates.push({
    row,
    after,
    ghostBefore,
    ghostAfter: ghostText(after),
    visibleMatches: visibleState(row.data) === visibleState(after),
    idempotent: compact(after).equals(after)
  })
}

if (candidates.length === 0) {
  console.log('Every row is already compact — nothing to rewrite.')
  await prisma.$disconnect()
  process.exit(failed ? 1 : 0)
}

console.log(`Rows that would change (${candidates.length})`)
console.log('  document              ver  name                      before →   after    saved')
for (const c of candidates) {
  const name = (c.row.commitMessage || '—').slice(0, 24).padEnd(24)
  console.log(
    `  ${c.row.documentId.padEnd(21)} ${String(c.row.version).padStart(3)}  ${name} ` +
      `${bytes(c.row.data.byteLength).padStart(8)} → ${bytes(c.after.byteLength).padStart(8)}  ` +
      `${pct(c.row.data.byteLength, c.after.byteLength).padStart(7)}` +
      `${c.ghostBefore.length > 0 ? `  (${bytes(ghostLength(c.ghostBefore))} ghost chars)` : ''}`
  )
}

const changedBefore = candidates.reduce((sum, c) => sum + c.row.data.byteLength, 0)
const changedAfter = candidates.reduce((sum, c) => sum + c.after.byteLength, 0)
console.log(
  `\n  changed rows: ${bytes(changedBefore)} → ${bytes(changedAfter)} B (${pct(changedBefore, changedAfter)})`
)
console.log(
  `  corpus:       ${bytes(totalBefore)} → ${bytes(totalBefore - changedBefore + changedAfter)} B ` +
    `(${pct(totalBefore, totalBefore - changedBefore + changedAfter)})\n`
)

console.log('Per-row safety')
const visibleOk = candidates.filter((c) => c.visibleMatches).length
const ghostCleared = candidates.filter((c) => c.ghostBefore.length > 0 && c.ghostAfter.length === 0)
const stillCarrying = candidates.filter((c) => c.ghostAfter.length > 0)
check(
  visibleOk === candidates.length,
  `visible state identical on ${visibleOk}/${candidates.length} rows`
)
check(
  candidates.every((c) => c.idempotent),
  `re-encoding is idempotent on ${candidates.filter((c) => c.idempotent).length}/${candidates.length} rows`
)
check(
  stillCarrying.length === 0 && ghostCleared.length === carrying.length,
  `deleted text erased from ${ghostCleared.length}/${carrying.length} carriers`
)

if (failed) {
  console.log('\nControls failed — refusing to write.')
  await prisma.$disconnect()
  process.exit(1)
}

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply.')
  await prisma.$disconnect()
  process.exit(0)
}

console.log('\nApplying')
let written = 0
let skipped = 0
for (const c of candidates) {
  // Guard on the bytes we actually inspected: a row deleted by the reaper or
  // rewritten by an earlier pass must be left alone, not overwritten blind.
  const affected = await prisma.$executeRaw`
    UPDATE "Documents" SET data = ${c.after}
    WHERE id = ${c.row.id} AND md5(data) = ${md5(c.row.data)}
  `
  if (affected !== 1) {
    skipped += 1
    console.log(`  ⚠ ${c.row.documentId} v${c.row.version} changed underneath us — skipped`)
    continue
  }

  const [reread] = await prisma.$queryRaw<{ data: Buffer }[]>`
    SELECT data FROM "Documents" WHERE id = ${c.row.id}
  `
  const ok = reread !== undefined && visibleState(reread.data) === visibleState(c.row.data)
  check(ok, `${c.row.documentId} v${c.row.version} reads back identical`)
  written += 1

  // Stop on the first row whose visible text moved. One bad re-encode means the
  // comparator or the strip is wrong for this corpus, and the remaining rows
  // would inherit the same fault — 35 more rewrites is not a better outcome.
  if (!ok) {
    console.log('\n✗ Read-back diverged. Halting before any further row is rewritten.')
    break
  }
}

console.log(`\nWrote ${written} rows, skipped ${skipped}.`)
await prisma.$disconnect()
process.exit(failed ? 1 : 0)
