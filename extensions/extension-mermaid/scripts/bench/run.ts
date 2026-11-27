/**
 * Mermaid byte bench: dist ESM, StarterKit app cost (eager entry with `pele/*` external), and
 * helper-only import against a git ref or npm tarball (#784).
 * Usage: NODE_ENV=production bun scripts/bench/run.ts [--ref main] [--bytes-only]
 *   [--budget scripts/bench/bytes-budget.json] [--save file.json]
 */
/* eslint-disable no-console -- a CLI that prints its report */
import { parseArgs } from 'node:util'

import { buildVariants, distSha256 } from './build'
import { type Bytes, checkBudget, measureBytes, type Size } from './bytes'
import { type Variant, VARIANTS } from './paths'

const { values } = parseArgs({
  options: {
    ref: { type: 'string', default: 'main' },
    save: { type: 'string' },
    'bytes-only': { type: 'boolean', default: true },
    budget: { type: 'string' }
  }
})

await buildVariants(values.ref!)

const bytes = {} as Record<Variant, Bytes>
for (const v of VARIANTS) bytes[v] = await measureBytes(v)

const result = {
  ref: values.ref!,
  date: new Date().toISOString(),
  where: `Bun ${Bun.version}, ${process.platform} ${process.arch}`,
  distSha256: distSha256(),
  bytes
}

const n = (x: number) => x.toLocaleString('en-US')
const signed = (x: number) => (x > 0 ? '+' : '') + n(x)
const size = (s: Size) => `${n(s.min)} / ${n(s.gz)}`
const row = (label: string, pick: (b: Bytes) => Size) => {
  const a = pick(bytes.base)
  const b = pick(bytes.head)
  return `| ${label} | ${size(a)} | ${size(b)} | ${signed(b.min - a.min)} / ${signed(b.gz - a.gz)} |`
}

const report = [
  `base = \`${result.ref}\`, head = working tree. Bytes only, ${result.date}.`,
  '',
  '| Metric | base | head | Change |',
  '| --- | --- | --- | --- |',
  row('Bytes: npm `dist/index.js` (min / gz)', (b) => b.distEsm),
  row('Bytes: a StarterKit app pays (min / gz)', (b) => b.starterKitApp),
  row('Bytes: `mermaidNodeView`-only import (min / gz)', (b) => b.helperOnly)
].join('\n')

if (values.save) await Bun.write(values.save, JSON.stringify(result, null, 1))
console.log(report)

if (values.budget) {
  const { over, report: budgetReport } = await checkBudget(bytes.head, values.budget)
  console.log(`\n${budgetReport}`)
  if (over) process.exit(1)
}
