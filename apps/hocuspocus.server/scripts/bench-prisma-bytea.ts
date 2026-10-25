/**
 * Times the Prisma `bytea` reads #198 names, so one script measures 6.19.3 and 7.10.1
 * on one machine. A measurement tool, not a test; it seeds and deletes its own Yjs fixtures.
 * Run: bun --env-file=../../.env.local scripts/bench-prisma-bytea.ts [--docker-image <tag>]
 */
import { existsSync, readFileSync } from 'node:fs'

import * as Y from 'yjs'

import { stripSnapshotMetadata } from '../src/lib/snapshotMetadata'

// Before the dynamic import: `development` adds a query log handler and
// `production` turns on TLS, which local Postgres refuses.
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'warn'
const { prisma } = await import('../src/lib/prisma')

const RUNS = 7
const PREFIX = 'bench-prisma-bytea-'
const HEAD_ID = `${PREFIX}head`
const PAIR_ID = `${PREFIX}pair`
const SMALL_ID = `${PREFIX}small`
const HEAD_BYTES = 5_357_733 // the largest production head (CLAUDE.md, 2026-09-05)
const PAIR_ROW_BYTES = 10_521_216 / 2 // the #198 digest version pair
const SMALL_PARAGRAPHS = 4
const CGROUP_PEAK = '/sys/fs/cgroup/memory.peak'
const PACKAGE_ROOT = new URL('..', import.meta.url).pathname

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const option = (name: string) => {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}

// mulberry32: the same seed gives the same bytes on every run and machine.
const prng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const WORDS = 'the doc plus pad section heading note team plan draft edit review chat'.split(' ')

const sentence = (rand: () => number, chars: number) => {
  let out = ''
  while (out.length < chars) out += `${WORDS[Math.floor(rand() * WORDS.length)]} `
  return out.slice(0, chars)
}

const addParagraph = (doc: Y.Doc, text: string) => {
  const paragraph = new Y.XmlElement('paragraph')
  paragraph.insert(0, [new Y.XmlText(text)])
  doc.getXmlFragment('default').push([paragraph])
}

// ASCII text encodes one byte per char, so the last paragraph's length is tuned
// until the update is exactly `target` bytes.
const syntheticDoc = (seed: number, target: number): Uint8Array => {
  const rand = prng(seed)
  const doc = new Y.Doc()
  doc.clientID = seed
  let size = Y.encodeStateAsUpdate(doc).length
  // The 200 B guess is above the real paragraph cost, so the loop never overshoots.
  while (size < target - 4096) {
    doc.transact(() => {
      for (let i = 0; i < 1000 && size < target - 4096; i++) {
        addParagraph(doc, sentence(rand, 140))
        size += 200
      }
    })
    size = Y.encodeStateAsUpdate(doc).length
  }
  const base = Y.encodeStateAsUpdate(doc)
  let tail = target - base.length
  for (let attempt = 0; attempt < 8 && tail > 0; attempt++) {
    // A second client id: Yjs re-rolls an id it finds in an applied update.
    const trial = new Y.Doc()
    trial.clientID = seed + 1000
    Y.applyUpdate(trial, base)
    addParagraph(trial, sentence(prng(seed + 1), tail))
    const update = Y.encodeStateAsUpdate(trial)
    if (update.length === target) return update
    tail -= update.length - target
  }
  throw new Error(`could not build a ${target} B fixture for seed ${seed}`)
}

const smallDoc = (seed: number): Uint8Array => {
  const rand = prng(seed)
  const doc = new Y.Doc()
  doc.clientID = seed
  for (let i = 0; i < SMALL_PARAGRAPHS; i++) addParagraph(doc, sentence(rand, 140))
  return Y.encodeStateAsUpdate(doc)
}

const cleanup = () =>
  prisma.documentMetadata.deleteMany({ where: { documentId: { startsWith: PREFIX } } })

const seed = async () => {
  await cleanup()
  const head = syntheticDoc(1, HEAD_BYTES)
  const pair = [syntheticDoc(2, PAIR_ROW_BYTES), syntheticDoc(3, PAIR_ROW_BYTES)]
  const small = smallDoc(4)
  const rows = [
    { documentId: HEAD_ID, versions: [head] },
    { documentId: PAIR_ID, versions: pair },
    { documentId: SMALL_ID, versions: [small] }
  ]
  for (const { documentId, versions } of rows) {
    await prisma.documentMetadata.create({ data: { documentId, slug: documentId } })
    for (const [index, data] of versions.entries()) {
      await prisma.documents.create({
        data: { documentId, version: index + 1, data: Buffer.from(data) }
      })
    }
  }
  return {
    headBytes: head.length,
    pairBytes: pair[0].length + pair[1].length,
    smallBytes: small.length
  }
}

const pairIds = async () =>
  (
    await prisma.documents.findMany({
      where: { documentId: PAIR_ID },
      orderBy: { version: 'asc' },
      select: { id: true }
    })
  ).map((row) => row.id)

// The widest gap between setInterval(0) ticks is how long the read held the loop.
const loopBlock = async (read: () => Promise<unknown>) => {
  let last = performance.now()
  let blockMs = 0
  const probe = setInterval(() => {
    const now = performance.now()
    blockMs = Math.max(blockMs, now - last)
    last = now
  }, 0)
  await read()
  await Bun.sleep(5)
  clearInterval(probe)
  return blockMs
}

const wall = async (work: () => Promise<unknown>) => {
  const start = performance.now()
  await work()
  return performance.now() - start
}

const summarize = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b)
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    median: round(sorted[Math.floor(sorted.length / 2)]),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    samples: samples.map(round)
  }
}

// One warm-up run is dropped, so connection setup never lands in a sample.
const repeat = async (measure: () => Promise<number>) => {
  await measure()
  const samples: number[] = []
  for (let i = 0; i < RUNS; i++) samples.push(await measure())
  return summarize(samples)
}

const coldLoadRead = () =>
  prisma.documents.findFirst({
    where: { documentId: HEAD_ID },
    orderBy: { version: 'desc' },
    select: { data: true, version: true }
  })

const watchRead = () =>
  prisma.documents.findFirst({
    where: { documentId: HEAD_ID, version: 1 },
    select: { data: true, version: true, commitMessage: true, createdAt: true }
  })

const smallLoad = () =>
  prisma.documents.findFirst({
    where: { documentId: SMALL_ID },
    orderBy: { version: 'desc' },
    select: { data: true, version: true }
  })

// The worker's save transaction (src/lib/queue.ts) without the slug and metadata arms.
const smallSave = (incoming: Uint8Array) =>
  prisma.$transaction(async (tx) => {
    const [head] = await tx.$queryRaw<{ version: number; data: Uint8Array }[]>`
      SELECT version, data FROM "Documents"
      WHERE "documentId" = ${SMALL_ID}
      ORDER BY version DESC
      LIMIT 1
      FOR UPDATE
    `
    const data = stripSnapshotMetadata(Y.mergeUpdates([new Uint8Array(head.data), incoming]))
    await tx.documents.create({ data: { documentId: SMALL_ID, version: head.version + 1, data } })
  })

const readPeakBytes = async () => {
  // Not Bun.file: after exists() it trusts the stat size, sysfs reports 0, and text() reads ''.
  if (existsSync(CGROUP_PEAK)) {
    return { bytes: Number(readFileSync(CGROUP_PEAK, 'utf8').trim()), source: 'cgroup' }
  }
  // maxRSS is in KiB on both Linux and macOS.
  return { bytes: process.resourceUsage().maxRSS * 1024, source: 'maxRSS' }
}

// memory.peak only rises within one cgroup, so each sample needs its own process.
const fetchPeakOnce = async () => {
  const ids = await pairIds()
  if (ids.length !== 2) throw new Error('pair fixture missing: run without --fetch-peak-once')
  const before = await readPeakBytes()
  const rows = await prisma.documents.findMany({
    where: { id: { in: ids } },
    select: { id: true, data: true }
  })
  const after = await readPeakBytes()
  const fetchedBytes = rows.reduce((sum, row) => sum + row.data.length, 0)
  console.log(
    JSON.stringify({
      peakBytes: after.bytes,
      beforeBytes: before.bytes,
      source: after.source,
      fetchedBytes
    })
  )
}

// A container reaches the host database as host.docker.internal, not localhost.
const childCommand = (image: string | undefined) => {
  const self = ['scripts/bench-prisma-bytea.ts', '--fetch-peak-once']
  if (!image) return { cmd: [process.execPath, ...self], env: process.env }
  const url = (process.env.DATABASE_URL ?? '').replace(
    /@(localhost|127\.0\.0\.1)([:/])/,
    '@host.docker.internal$2'
  )
  const cmd = [
    'docker',
    'run',
    '--rm',
    '--memory=1g',
    // The env schema refuses to load without these three; the values are never dialled.
    '-e',
    'DATABASE_URL',
    '-e',
    'SUPABASE_URL',
    '-e',
    'SUPABASE_ANON_KEY',
    '-v',
    `${import.meta.path}:/app/apps/hocuspocus.server/scripts/bench-prisma-bytea.ts:ro`,
    '-w',
    '/app/apps/hocuspocus.server',
    '--entrypoint',
    'bun',
    image,
    ...self
  ]
  return { cmd, env: { ...process.env, DATABASE_URL: url } }
}

const fetchPeak = async (image: string | undefined) => {
  const { cmd, env } = childCommand(image)
  const samples: number[] = []
  let source = ''
  // Exit 137 is the 1g cgroup OOM kill. It is a result, so it is counted, not thrown.
  let oomKills = 0
  for (let i = 0; i < RUNS; i++) {
    const child = Bun.spawn(cmd, { cwd: PACKAGE_ROOT, env, stdout: 'pipe', stderr: 'inherit' })
    const out = await new Response(child.stdout).text()
    const code = await child.exited
    if (code === 137) {
      oomKills++
      continue
    }
    if (code !== 0) throw new Error(`fetch-peak sample ${i + 1} exited ${code}`)
    const sample = JSON.parse(out.trim().split('\n').at(-1) ?? '{}')
    samples.push(sample.peakBytes / 1024 / 1024)
    source = sample.source
  }
  return {
    unit: 'MiB',
    source,
    runner: image ? `docker ${image} --memory=1g` : 'bun',
    oomKills,
    ...(samples.length > 0 ? summarize(samples) : {})
  }
}

const versionOf = async (pkg: string) =>
  (await Bun.file(Bun.resolveSync(`${pkg}/package.json`, PACKAGE_ROOT)).json()).version as string

const main = async () => {
  if (flag('--fetch-peak-once')) return fetchPeakOnce()

  const image = option('--docker-image')
  const fixtures = await seed()
  const incoming = smallDoc(5)
  const results = {
    coldLoadHeadReadLoopBlockMs: await repeat(() => loopBlock(coldLoadRead)),
    historyWatchReadLoopBlockMs: await repeat(() => loopBlock(watchRead)),
    smallDocLoadMs: await repeat(() => wall(smallLoad)),
    smallDocSaveMs: await repeat(() => wall(() => smallSave(incoming))),
    digestPairFetchPeak: flag('--skip-fetch-peak') ? null : await fetchPeak(image)
  }
  console.log(
    JSON.stringify(
      {
        date: new Date().toISOString(),
        bun: Bun.version,
        platform: `${process.platform}-${process.arch}`,
        prismaClient: await versionOf('@prisma/client'),
        adapterPg: await versionOf('@prisma/adapter-pg'),
        runs: RUNS,
        fixtures,
        results
      },
      null,
      2
    )
  )
}

const stop = async (code: number) => {
  if (!flag('--fetch-peak-once')) await cleanup().catch(() => {})
  await prisma.$disconnect()
  process.exit(code)
}

process.on('SIGINT', () => void stop(130))

try {
  await main()
  await stop(0)
} catch (error) {
  console.error(error)
  await stop(1)
}
