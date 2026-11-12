/**
 * Hyperlink bench: bytes, behaviour and jsdom speed for this working tree against a git ref.
 * Usage: NODE_ENV=production bun scripts/bench/run.ts [--ref main] [--runs 9] [--save file.json]
 * Prints a Markdown table. README.md in this folder says how to read it.
 */
/* eslint-disable no-console -- a CLI that prints its report */
import '../../src/link-icons/__tests__/setupDom'

import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { runBehaviour } from './behaviour'
import { buildVariants } from './build'
import { measureBytes } from './bytes'
import { median, OUT, resolveFromPkg, VARIANTS } from './paths'
import { type BenchResult, renderTable } from './table'
import { type Env, type HyperlinkModule, WORKLOADS } from './workloads'

const { values } = parseArgs({
  options: {
    ref: { type: 'string', default: 'main' },
    runs: { type: 'string', default: '9' },
    save: { type: 'string' }
  }
})
const runs = Number(values.runs)

await buildVariants(values.ref!)

const { Editor } = await import(resolveFromPkg('@tiptap/core'))
const StarterKit = (await import(resolveFromPkg('@tiptap/starter-kit'))).default
const stage = document.createElement('div')
document.body.append(stage)
const env: Env = { Editor, StarterKit, win: window as Window & typeof globalThis, stage }
const mods = {} as Record<(typeof VARIANTS)[number], HyperlinkModule>
for (const v of VARIANTS) mods[v] = await import(join(OUT, v, 'dist', 'rt.js'))

const result: BenchResult = {
  ref: values.ref!,
  date: new Date().toISOString(),
  where: `jsdom on Bun ${Bun.version}, ${process.platform} ${process.arch}`,
  runs,
  bytes: {} as BenchResult['bytes'],
  behaviour: {} as BenchResult['behaviour'],
  speed: {}
}
for (const v of VARIANTS) {
  result.bytes[v] = await measureBytes(v)
  result.behaviour[v] = runBehaviour(env, mods[v])
}

// Every round runs each variant once, in rotated order, so drift hits all of them alike.
for (const [name, workload] of Object.entries(WORKLOADS)) {
  for (const v of VARIANTS) workload.run(env, mods[v]).editor.destroy()
  const times: Record<string, number[]> = {}
  const docs: Record<string, string> = {}
  for (let r = 0; r < runs; r++) {
    for (let j = 0; j < VARIANTS.length; j++) {
      const v = VARIANTS[(j + r) % VARIANTS.length]
      const { editor, ms } = workload.run(env, mods[v])
      ;(times[v] ??= []).push(ms)
      docs[v] = JSON.stringify(editor.getJSON())
      editor.destroy()
      stage.replaceChildren()
    }
  }
  result.speed[name] = { unit: workload.unit }
  for (const v of VARIANTS)
    result.speed[name][v] = {
      median: +median(times[v]).toFixed(3),
      sameDocAsBase: docs[v] === docs.base
    }
}

if (values.save) await Bun.write(values.save, JSON.stringify(result, null, 1))
console.log(renderTable(result))
