/**
 * Markdown and Word import bench (#722, #577): time, peak RSS, nodes and Yjs size. Not
 * a test, since timing tests are banned. One child process per case keeps RSS apart.
 * Usage: bun scripts/bench-import.ts [sizes] | docx [sizes] [runs] | docx-images [counts] [runs]
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, platform, release, tmpdir, totalmem } from 'node:os'
import { join } from 'node:path'

import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { migrationExtensions } from '../src/lib/migration-extensions'
import { imageDocx, minimalDocx } from '../src/modules/document-conversion/__tests__/fixtures'
import { importDocx } from '../src/modules/document-conversion/domain/docxImport'
import { importMarkdown } from '../src/modules/document-conversion/domain/markdownImport'
import { zipInflateSize } from '../src/modules/document-conversion/domain/zipInflateSize'
import {
  MAX_IMPORT_WORD_PART_BYTES,
  MAX_INFLATED_IMPORT_BYTES
} from '../src/modules/document-conversion/types'

const KiB = 1024
const MiB = 1024 * KiB
const SIZES: Record<string, number> = {
  '64KiB': 64 * KiB,
  '512KiB': 512 * KiB,
  '256KiB': 256 * KiB,
  '1MiB': MiB,
  '2MiB': 2 * MiB,
  '3MiB': 3 * MiB,
  '4MiB': 4 * MiB,
  '10MiB': 10 * MiB,
  // Just under the 40 MiB inflate budget, so the walk admits it.
  '39MiB': 39 * MiB,
  '40MiB': 40 * MiB,
  '80MiB': 80 * MiB,
  '160MiB': 160 * MiB
}
// Unpacked `document.xml` sizes: 40 MiB is today's ceiling for a 10 MiB upload, 160 MiB
// is four times the owner's 40 MiB cap.
const DOCX_SIZES = ['1MiB', '2MiB', '4MiB', '10MiB', '40MiB', '80MiB']
const DOCX_RUNS = 5
const DOCX_IMAGE_COUNTS = ['18', '128', '512', '2048', '8192']
// REST's idleTimeout is 60 s, so a case past it has already failed in production.
const CASE_TIMEOUT_MS = 60_000
// rest-api runs in a 512M cgroup; stop well past that so the laptop never swaps.
const RSS_KILL_BYTES = 4 * 1024 * MiB

const lorem =
  'The garden plan lists every bed, the soil it needs and the week it is sown. ' +
  'Water early, mulch after rain, and keep a note of what failed so next year starts better. '

// Each shape repeats one unit until the target byte size. Hostile shapes aim at
// the parser (deep nesting, one long line) or at the node count (tiny runs).
const UNITS: Record<string, () => string> = {
  prose: () => `${lorem.repeat(3)}\n\n`,
  'heading-flood': () => '## H\n\n',
  'link-runs': () => '[a](https://e.x/1) *b* **c** `d` '.repeat(20) + '\n\n',
  'table-rows': () => '| a | b | c | d |\n',
  'long-line': () => 'word '.repeat(200),
  'deep-list': () => {
    let block = ''
    for (let depth = 0; depth < 64; depth += 1) block += `${'  '.repeat(depth)}- item\n`
    return `${block}\n`
  },
  'deep-quote': () => `${'>'.repeat(500)} text\n\n`
}

const buildMarkdown = (shape: string, bytes: number): string => {
  const unit = UNITS[shape]()
  const head =
    shape === 'table-rows' ? '# Title\n\n| a | b | c | d |\n| - | - | - | - |\n' : '# Title\n\n'
  const parts = [head]
  let size = head.length
  while (size < bytes) {
    parts.push(unit)
    size += unit.length
  }
  return parts.join('').slice(0, bytes)
}

// Plain paragraphs, deflated as Word does: the upload is small, the unpacked XML is not.
const buildDocx = (bytes: number): Buffer => {
  const paragraph = `<w:p><w:r><w:t>${lorem.repeat(3)}</w:t></w:r></w:p>`
  return minimalDocx(paragraph.repeat(Math.ceil(bytes / paragraph.length)))
}

const countNodes = (root: unknown): { nodes: number; depth: number } => {
  const stack: { node: Record<string, unknown>; depth: number }[] = [
    { node: root as Record<string, unknown>, depth: 0 }
  ]
  let nodes = 0
  let maxDepth = 0
  while (stack.length) {
    const { node, depth } = stack.pop() as { node: Record<string, unknown>; depth: number }
    nodes += 1
    if (depth > maxDepth) maxDepth = depth
    if (Array.isArray(node.content)) {
      for (const child of node.content) stack.push({ node: child, depth: depth + 1 })
    }
  }
  return { nodes, depth: maxDepth }
}

// The parent writes each Word file once, so the child's start RSS holds no build garbage.
const runCase = async (shape: string, sizeLabel: string, docxPath?: string) => {
  const row: Record<string, unknown> = { shape, size: sizeLabel }
  const emit = () => console.log(JSON.stringify(row))
  const peak = () => process.resourceUsage().maxRSS * KiB
  const docx = docxPath ? readFileSync(docxPath) : null
  const markdown = docx ? '' : buildMarkdown(shape, SIZES[sizeLabel])
  row.uploadBytes = docx ? docx.length : Buffer.byteLength(markdown)
  row.startRss = process.memoryUsage().rss

  let started = performance.now()
  if (docx) {
    // The walk runs first in the handler too, so its memory counts toward the import.
    row.walk = zipInflateSize(docx, MAX_INFLATED_IMPORT_BYTES, MAX_IMPORT_WORD_PART_BYTES)
    row.walkMs = Number((performance.now() - started).toFixed(2))
    started = performance.now()
  }
  let result
  try {
    result = docx
      ? await importDocx(docx, {
          fallbackTitle: 'bench',
          uploadImage: async () => {
            row.images = ((row.images as number) ?? 0) + 1
            return 'https://media.test/x.png'
          }
        })
      : importMarkdown(markdown, 'bench')
  } catch (error) {
    row.error = `import: ${(error as Error).message.slice(0, 80)}`
    row.peakRss = peak()
    // A refusal after the parse still costs the parse.
    row.addedRss = (row.peakRss as number) - (row.startRss as number)
    return emit()
  }
  row.importMs = Math.round(performance.now() - started)
  row.importRss = peak()
  row.importAddedRss = (row.importRss as number) - (row.startRss as number)
  Object.assign(row, countNodes(result.content))
  row.jsonBytes = JSON.stringify(result.content).length

  started = performance.now()
  try {
    const doc = TiptapTransformer.toYdoc(result.content, 'default', migrationExtensions)
    row.yjsBytes = Y.encodeStateAsUpdate(doc).byteLength
    row.encodeMs = Math.round(performance.now() - started)
  } catch (error) {
    row.error = `encode: ${(error as Error).message.slice(0, 80)}`
  }
  row.peakRss = peak()
  row.addedRss = (row.peakRss as number) - (row.startRss as number)
  emit()
}

const sh = (cmd: string[]) => new TextDecoder().decode(Bun.spawnSync(cmd).stdout).trim()

const fmtBytes = (n: unknown) =>
  typeof n === 'number'
    ? n >= MiB
      ? `${(n / MiB).toFixed(1)} MiB`
      : `${(n / KiB).toFixed(0)} KiB`
    : '-'

// `marked` is not a direct dependency, so resolve it from the package that pulls it in.
const pkg = (name: string, from = import.meta.dir) => {
  try {
    return JSON.parse(readFileSync(Bun.resolveSync(`${name}/package.json`, from), 'utf8')).version
  } catch {
    return 'missing'
  }
}

const printEnvironment = () => {
  const tiptapMarkdown = join(Bun.resolveSync('@tiptap/markdown', import.meta.dir), '..')
  console.log(
    JSON.stringify({
      date: new Date().toISOString(),
      bun: Bun.version,
      commit: sh(['git', 'rev-parse', '--short', 'HEAD']),
      cpu: cpus()[0]?.model,
      os: `${platform()} ${release()}`,
      memoryGb: Math.round(totalmem() / 2 ** 30),
      marked: pkg('marked', tiptapMarkdown),
      mammoth: pkg('mammoth'),
      yjs: pkg('yjs')
    })
  )
}

const spawnCase = async (args: string[]): Promise<Record<string, unknown>> => {
  const child = Bun.spawn(['bun', import.meta.path, '--case', ...args], {
    cwd: join(import.meta.dir, '..'),
    stdout: 'pipe',
    stderr: 'pipe'
  })
  let killed = ''
  const timer = setTimeout(() => {
    killed = `killed at ${CASE_TIMEOUT_MS / 1000}s`
    child.kill()
  }, CASE_TIMEOUT_MS)
  const sampler = setInterval(() => {
    const rss = Number(sh(['ps', '-o', 'rss=', '-p', String(child.pid)])) * KiB
    if (rss > RSS_KILL_BYTES) {
      killed = `killed at RSS ${fmtBytes(rss)}`
      child.kill()
    }
  }, 250)
  const out = await new Response(child.stdout).text()
  const code = await child.exited
  clearTimeout(timer)
  clearInterval(sampler)
  const line = out.trim().split('\n').pop() ?? ''
  try {
    return JSON.parse(line)
  } catch {
    return { shape: args[0], size: args[1], error: killed || `exit ${code}` }
  }
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const summary = (rows: Record<string, unknown>[], key: string, fmt: (n: number) => string) => {
  const values = rows.map((row) => row[key]).filter((v): v is number => typeof v === 'number')
  if (!values.length) return '-'
  return `${fmt(median(values))} (${fmt(Math.min(...values))}–${fmt(Math.max(...values))})`
}

// Every run prints a JSON line, then each size prints median and range of `runs`.
const benchDocx = async (shape: 'docx-prose' | 'docx-images', sizes: string[], runs: number) => {
  printEnvironment()
  const dir = mkdtempSync(join(tmpdir(), 'bench-import-'))
  const rowsBySize: Record<string, Record<string, unknown>[]> = {}
  try {
    for (const size of sizes) {
      const path = join(dir, `${size}.docx`)
      writeFileSync(
        path,
        shape === 'docx-images' ? imageDocx(Number(size)) : buildDocx(SIZES[size])
      )
      rowsBySize[size] = []
      for (let run = 1; run <= runs; run += 1) {
        const row = { run, ...(await spawnCase([shape, size, path])) }
        console.log(JSON.stringify(row))
        rowsBySize[size].push(row)
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  const mib = (n: number) => (n / MiB).toFixed(1)
  const ms = (n: number) => String(Math.round(n * 100) / 100)
  console.log(
    `| size | upload | images | walk result | walk ms | import ms | start RSS MiB | added after import MiB | peak RSS MiB | added RSS MiB | errors |`
  )
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const size of sizes) {
    const rows = rowsBySize[size]
    const errors = rows.filter((row) => row.error).map((row) => row.error)
    console.log(
      `| ${size} | ${fmtBytes(rows[0]?.uploadBytes)} | ${rows[0]?.images ?? 0} | ${JSON.stringify(rows[0]?.walk ?? null)} | ${summary(rows, 'walkMs', ms)} | ${summary(rows, 'importMs', ms)} | ${summary(rows, 'startRss', mib)} | ${summary(rows, 'importAddedRss', mib)} | ${summary(rows, 'peakRss', mib)} | ${summary(rows, 'addedRss', mib)} | ${errors.length} of ${rows.length}${errors.length ? `: ${errors.join('; ')}` : ''} |`
    )
  }
}

const main = async () => {
  const [mode, shape, size, docxPath] = process.argv.slice(2)
  if (mode === '--case') return runCase(shape, size, docxPath)
  if (mode === 'docx') {
    return benchDocx('docx-prose', shape ? shape.split(',') : DOCX_SIZES, Number(size) || DOCX_RUNS)
  }
  // Sizes here are image counts.
  if (mode === 'docx-images') {
    return benchDocx(
      'docx-images',
      shape ? shape.split(',') : DOCX_IMAGE_COUNTS,
      Number(size) || DOCX_RUNS
    )
  }

  const cases = (mode ? mode.split(',') : ['64KiB', '256KiB', '1MiB', '10MiB', '40MiB']).flatMap(
    (size) => Object.keys(UNITS).map((name) => [size, name])
  )
  printEnvironment()
  console.log(
    '| shape | size | upload | import ms | RSS after import | encode ms | peak RSS | nodes | depth | JSON | Yjs |'
  )
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const [size, name] of cases) {
    const row = await spawnCase([name, size])
    const cell = (key: string) => (row[key] == null ? '-' : String(row[key]))
    console.log(
      `| ${name} | ${size} | ${fmtBytes(row.uploadBytes)} | ${cell('importMs')} | ${fmtBytes(row.importRss)} | ${cell('encodeMs')} | ${fmtBytes(row.peakRss)} | ${cell('nodes')} | ${cell('depth')} | ${fmtBytes(row.jsonBytes)} | ${fmtBytes(row.yjsBytes)} |${row.error ? ` ${row.error}` : ''}`
    )
  }
}

await main()
