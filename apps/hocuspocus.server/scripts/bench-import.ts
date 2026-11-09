/**
 * Markdown and Word import bench (#722): time, peak RSS, nodes and Yjs size. Not a
 * test, since timing tests are banned. One child process per case keeps RSS apart.
 * Usage: bun scripts/bench-import.ts [sizes] | docx (Word text at each unpacked size)
 */
import { readFileSync } from 'node:fs'
import { cpus, platform, release, totalmem } from 'node:os'
import { join } from 'node:path'

import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { migrationExtensions } from '../src/lib/migration-extensions'
import { minimalDocx } from '../src/modules/document-conversion/__tests__/fixtures'
import { importDocx } from '../src/modules/document-conversion/domain/docxImport'
import { importMarkdown } from '../src/modules/document-conversion/domain/markdownImport'

const KiB = 1024
const MiB = 1024 * KiB
const SIZES: Record<string, number> = {
  '64KiB': 64 * KiB,
  '256KiB': 256 * KiB,
  '1MiB': MiB,
  '10MiB': 10 * MiB,
  '40MiB': 40 * MiB,
  '80MiB': 80 * MiB,
  '160MiB': 160 * MiB
}
// Unpacked `document.xml` sizes: 40 MiB is today's ceiling for a 10 MiB upload, 160 MiB
// is four times the owner's 40 MiB cap.
const DOCX_SIZES = ['10MiB', '40MiB', '80MiB', '160MiB']
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

const runCase = async (shape: string, sizeLabel: string) => {
  const row: Record<string, unknown> = { shape, size: sizeLabel }
  const emit = () => console.log(JSON.stringify(row))
  const peak = () => process.resourceUsage().maxRSS * KiB
  const docx = shape === 'docx-prose' ? buildDocx(SIZES[sizeLabel]) : null
  const markdown = docx ? '' : buildMarkdown(shape, SIZES[sizeLabel])
  row.uploadBytes = docx ? docx.length : Buffer.byteLength(markdown)

  let started = performance.now()
  let result
  try {
    result = docx
      ? await importDocx(docx, {
          fallbackTitle: 'bench',
          uploadImage: async () => 'https://media.test/x.png'
        })
      : importMarkdown(markdown, 'bench')
  } catch (error) {
    row.error = `import: ${(error as Error).message.slice(0, 80)}`
    row.peakRss = peak()
    return emit()
  }
  row.importMs = Math.round(performance.now() - started)
  row.importRss = peak()
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
  emit()
}

const sh = (cmd: string[]) => new TextDecoder().decode(Bun.spawnSync(cmd).stdout).trim()

const fmtBytes = (n: unknown) =>
  typeof n === 'number'
    ? n >= MiB
      ? `${(n / MiB).toFixed(1)} MiB`
      : `${(n / KiB).toFixed(0)} KiB`
    : '-'

const main = async () => {
  const [mode, shape, size] = process.argv.slice(2)
  if (mode === '--case') return runCase(shape, size)

  const cases =
    mode === 'docx'
      ? DOCX_SIZES.map((size) => [size, 'docx-prose'])
      : (mode ? mode.split(',') : ['64KiB', '256KiB', '1MiB', '10MiB', '40MiB']).flatMap((size) =>
          Object.keys(UNITS).map((name) => [size, name])
        )
  // `marked` is not a direct dependency, so resolve it from the package that pulls it in.
  const pkg = (name: string, from = import.meta.dir) => {
    try {
      return JSON.parse(readFileSync(Bun.resolveSync(`${name}/package.json`, from), 'utf8')).version
    } catch {
      return 'missing'
    }
  }
  const tiptapMarkdown = join(Bun.resolveSync('@tiptap/markdown', import.meta.dir), '..')
  console.log(
    JSON.stringify({
      date: new Date().toISOString(),
      bun: Bun.version,
      cpu: cpus()[0]?.model,
      os: `${platform()} ${release()}`,
      memoryGb: Math.round(totalmem() / 2 ** 30),
      marked: pkg('marked', tiptapMarkdown),
      yjs: pkg('yjs')
    })
  )
  console.log(
    '| shape | size | upload | import ms | RSS after import | encode ms | peak RSS | nodes | depth | JSON | Yjs |'
  )
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const [size, name] of cases) {
    const child = Bun.spawn(['bun', import.meta.path, '--case', name, size], {
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
    let row: Record<string, unknown>
    try {
      row = JSON.parse(line)
    } catch {
      const reason = killed || `exit ${code}`
      row = { shape: name, size, error: reason }
    }
    const cell = (key: string) => (row[key] == null ? '-' : String(row[key]))
    console.log(
      `| ${name} | ${size} | ${fmtBytes(row.uploadBytes)} | ${cell('importMs')} | ${fmtBytes(row.importRss)} | ${cell('encodeMs')} | ${fmtBytes(row.peakRss)} | ${cell('nodes')} | ${cell('depth')} | ${fmtBytes(row.jsonBytes)} | ${fmtBytes(row.yjsBytes)} |${row.error ? ` ${row.error}` : ''}`
    )
  }
}

await main()
