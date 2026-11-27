/**
 * Shared extension byte-bench CLI runner (#784): builds `base` and `head` into a temp directory,
 * measures dist ESM, StarterKit app cost, and helper-only import sizes, prints a Markdown table,
 * and optionally enforces a `bytes-budget.json` file.
 *
 * Packages that do not opt into `keepPureAnnotations: true` yet set `"helperOnlyGz": null` in
 * `bytes-budget.json` so upstream `@tiptap/*`/`prosemirror-*` bumps do not spuriously fail PR CI;
 * the measured `helperOnly` size is still reported.
 */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'

import { buildVariants, distSha256 } from './build'
import { checkBudget, measureBytes } from './bytes'
import { type Bytes, type ExtensionBenchConfig, type Size, type Variant, VARIANTS } from './types'

const n = (x: number) => x.toLocaleString('en-US')
const signed = (x: number) => (x > 0 ? '+' : '') + n(x)
const size = (s: Size) => `${n(s.min)} / ${n(s.gz)}`

export async function runExtensionBench(config: ExtensionBenchConfig): Promise<void> {
  const { values } = parseArgs({
    options: {
      ref: { type: 'string', default: 'main' },
      save: { type: 'string' },
      // Accepted for CLI parity with the shared extension-bytes CI command.
      'bytes-only': { type: 'boolean', default: true },
      budget: { type: 'string' }
    }
  })

  const slug = basename(config.packageRoot).replace(/^extension-/, '')
  const outDir = realpathSync(mkdtempSync(join(tmpdir(), `docsplus-${slug}-bench-`)))
  const cleanup = () => rmSync(outDir, { recursive: true, force: true })
  process.on('exit', cleanup)

  try {
    await buildVariants(config, outDir, values.ref!)

    const bytes = {} as Record<Variant, Bytes>
    for (const v of VARIANTS) bytes[v] = await measureBytes(config, outDir, v)

    const result = {
      ref: values.ref!,
      date: new Date().toISOString(),
      where: `Bun ${Bun.version}, ${process.platform} ${process.arch}`,
      distSha256: distSha256(outDir),
      bytes
    }

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
      row(`Bytes: \`${config.helperLabel}\`-only import (min / gz)`, (b) => b.helperOnly)
    ].join('\n')

    if (values.save) await Bun.write(values.save, JSON.stringify(result, null, 1))
    console.log(report)

    if (values.budget) {
      const { over, report: budgetReport } = await checkBudget(bytes.head, values.budget)
      console.log(`\n${budgetReport}`)
      if (over) process.exit(1)
    }
  } finally {
    cleanup()
  }
}
