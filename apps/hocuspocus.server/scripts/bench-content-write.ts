/**
 * #726 benchmark: MCP-style `blocks` writes on one document of about 3 MiB, through the content
 * client that `edit_blocks` uses, on a local production-mode stack (2 WS, 2 workers, Redis on).
 * Run from apps/hocuspocus.server: bun --env-file=../../.env.local scripts/bench-content-write.ts
 * Options: --mode cold|held, --writes 92, --runs 1, --gap-ms 0, --redis-db 8, --target-mib 3, --out <file>.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'

import type { Subprocess } from 'bun'
import Redis from 'ioredis'
import pino from 'pino'

import { buildFixture, mulberry32, nextEdit, paragraph } from './lib/benchFixture'
import { makeOpenProvider, sleep } from './lib/e2eHarness'
import {
  spawnWorker,
  spawnWs,
  startPgTlsProxy,
  type WorkerProcess,
  type WsProcess
} from './lib/prodModeStack'

// This process stands in for REST. `test` keeps the local pool off TLS and, as in
// production, logs no query. Set before the dynamic imports, because config freezes on import.
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'warn'
const { prisma } = await import('../src/lib/prisma')
const { createContentClient } = await import('../src/modules/document-content/infra/contentClient')
const { findSection } = await import('../src/modules/document-content/domain/sections')
const { TOC_ID_ATTR } = await import('../src/modules/document-content/types')

const args = process.argv.slice(2)
const option = (name: string, fallback: string) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : args[at + 1]
}
const mode = option('--mode', 'cold')
if (mode !== 'cold' && mode !== 'held') throw new Error(`unknown --mode ${mode}`)
const writes = Number(option('--writes', '92'))
const runs = Number(option('--runs', '1'))
const gapMs = Number(option('--gap-ms', '0'))
const redisDb = Number(option('--redis-db', '8'))
const targetBytes = Number(option('--target-mib', '3')) * 1024 * 1024
// Also refuses NaN. Without it the fixture has no section, and the first write fails late.
if (!(targetBytes > 0)) throw new Error('--target-mib must be above 0')
const seed = Number(option('--seed', '726'))
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const loadAtStart = os.loadavg()
const outPath = option('--out', join(os.tmpdir(), `bench-content-write-${mode}-${stamp}.json`))
const logFile = outPath.replace(/\.json$/, '') + '.log'

const SLUG_PREFIX = 'bench-content-write-'
// Production runs BULLMQ_CONCURRENCY = WORKER_DB_POOL_SIZE, default 10 (docker-compose.prod.yml).
const WORKER_CONCURRENCY = 10
// A fixed stand-in for the MCP caller, so every write mints a `trigger = 'mcp'` row.
const ACTOR = { sub: '00000000-0000-4000-8000-000000000726' }

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const newDocumentId = () => [...randomBytes(19)].map((byte) => BASE62[byte % 62]).join('')

// --- Prometheus text, diffed before and after a run.
type Samples = Map<string, number>
const parseMetrics = (text: string): Samples => {
  const out: Samples = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const space = line.lastIndexOf(' ')
    const value = Number(line.slice(space + 1))
    if (Number.isFinite(value)) out.set(line.slice(0, space), value)
  }
  return out
}
const scrape = async (url: string) => parseMetrics(await (await fetch(url)).text())

const delta = (before: Samples[], after: Samples[], match: (key: string) => boolean) =>
  after.reduce((sum, samples, i) => {
    for (const [key, value] of samples) if (match(key)) sum += value - (before[i].get(key) ?? 0)
    return sum
  }, 0)

type Buckets = [number, number][]
const histogram = (
  before: Samples[],
  after: Samples[],
  name: string,
  match = (_k: string) => true
) => {
  const byBound = new Map<number, number>()
  after.forEach((samples, i) => {
    for (const [key, value] of samples) {
      if (!key.startsWith(`${name}_bucket{`) || !match(key)) continue
      const le = key.match(/le="([^"]+)"/)?.[1]
      if (!le) continue
      const bound = le === '+Inf' ? Infinity : Number(le)
      byBound.set(bound, (byBound.get(bound) ?? 0) + value - (before[i].get(key) ?? 0))
    }
  })
  return [...byBound].sort((x, y) => x[0] - y[0]) as Buckets
}

// Exact, unlike a bucket quantile: the histogram's own sum over its own count.
const meanOf = (
  before: Samples[],
  after: Samples[],
  name: string,
  match = (_k: string) => true
) => {
  const part = (suffix: string) =>
    delta(
      before,
      after,
      (k) => (k === name + suffix || k.startsWith(`${name + suffix}{`)) && match(k)
    )
  const count = part('_count')
  return count > 0 ? Math.round((part('_sum') / count) * 10_000) / 10_000 : null
}

// Prometheus's own rule: interpolate inside the bucket; in +Inf, report the last finite bound.
const quantile = (buckets: Buckets, q: number): number | null => {
  const total = buckets.at(-1)?.[1] ?? 0
  if (total <= 0) return null
  const rank = q * total
  let lowerBound = 0
  let lowerCount = 0
  for (const [bound, count] of buckets) {
    if (count >= rank) {
      if (bound === Infinity) return lowerBound
      return lowerBound + ((bound - lowerBound) * (rank - lowerCount)) / (count - lowerCount)
    }
    lowerBound = bound
    lowerCount = count
  }
  return lowerBound
}

const round1 = (v: number) => Math.round(v * 10) / 10
const stats = (values: number[]) => {
  const sorted = [...values].sort((x, y) => x - y)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return sorted.length === 0
    ? null
    : { n: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted.at(-1)! }
}

// --- Stack: a TLS proxy, its own Redis DB, 2 WS and 2 workers in production mode.
const proxy = await startPgTlsProxy(process.env.DATABASE_URL ?? '')
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: redisDb
})
if ((await redis.dbsize()) !== 0) {
  throw new Error(`Redis DB ${redisDb} is not empty. Pick a free one with --redis-db.`)
}

const children: Subprocess[] = []
const stopAll = () => {
  for (const child of children) child.kill('SIGKILL')
}
process.once('exit', stopAll)
// A signal ends the process without 'exit' unless the handler calls process.exit.
process.once('SIGINT', () => process.exit(130))
process.once('SIGTERM', () => process.exit(143))

const base = { databaseUrl: proxy.url, redisDb, logFile }
const ws: WsProcess[] = []
for (const label of ['A', 'B']) {
  const instance = await spawnWs(label, base)
  children.push(instance.proc)
  ws.push(instance)
}
const workers: WorkerProcess[] = []
for (const label of ['W1', 'W2']) {
  const worker = await spawnWorker(label, base, WORKER_CONCURRENCY)
  children.push(worker.proc)
  workers.push(worker)
}
const scraped = [...ws, ...workers]

// The hop stays on one instance, as a keep-alive socket to one replica does in production.
const hop = ws[0]
const client = createContentClient({
  baseUrl: hop.internalUrl,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
  prisma,
  logger: pino({ level: 'error' })
})

const queueDepth = async () => {
  const lists = await Promise.all([
    redis.llen('bull:store-documents:wait'),
    redis.llen('bull:store-documents:active'),
    redis.zcard('bull:store-documents:delayed'),
    redis.zcard('bull:store-documents:prioritized')
  ])
  return lists.reduce((sum, n) => sum + n, 0)
}
const waitForDrain = async () => {
  let quiet = 0
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    quiet = (await queueDepth()) === 0 ? quiet + 1 : 0
    if (quiet >= 3) return
    await sleep(1000)
  }
  throw new Error('the store queue never drained')
}

// A deduped save still SETs its claim-check key, and no job deletes it, so it lives
// out its 1 h TTL (#704). Count them, then remove them: the queue is drained, so no
// job needs them, and the next run starts on the same Redis.
const takeOrphanStateKeys = async () => {
  let count = 0
  let bytes = 0
  for await (const keys of redis.scanStream({ match: 'store-doc-state:*', count: 500 })) {
    for (const key of keys as string[]) {
      count += 1
      bytes += await redis.strlen(key)
      await redis.unlink(key)
    }
  }
  return { count, bytes }
}

const sectionIds = (doc: { content?: { type?: string; attrs?: Record<string, unknown> }[] }) =>
  (doc.content ?? [])
    .filter((node) => node.type === 'heading' && node.attrs?.level === 2)
    .map((node) => String(node.attrs?.[TOC_ID_ATTR] ?? ''))
    .filter(Boolean)

const cleanup = () =>
  prisma.documentMetadata.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } })
await cleanup()

const results = []
for (let run = 1; run <= runs; run++) {
  const rand = mulberry32(seed + run)
  const documentId = newDocumentId()
  const slug = `${SLUG_PREFIX}${stamp}-${run}`
  await prisma.documentMetadata.create({
    data: { documentId, slug, title: 'Bench document', ownerId: ACTOR.sub }
  })

  // The seed write goes through the same hop, so the stored head is a real snapshot.
  const fixture = buildFixture(rand, targetBytes)
  const fixtureJsonBytes = Buffer.byteLength(JSON.stringify(fixture.doc))
  const seeded = await client.apply({ documentId, mode: 'replace', content: fixture.doc as never })
  if (seeded.status !== 'applied') throw new Error(`seed write failed: ${JSON.stringify(seeded)}`)
  await waitForDrain()
  // The seed leaves its own orphan key; take it now, so the run counts writes only.
  const seedOrphans = await takeOrphanStateKeys()
  const head = await prisma.documents.findFirst({
    where: { documentId },
    orderBy: { version: 'desc' },
    select: { version: true, data: true }
  })
  const storedBytes = head?.data.length ?? 0
  if (storedBytes < 1024 * 1024 || storedBytes > 4 * 1024 * 1024) {
    console.warn(`run ${run}: stored head is ${storedBytes} B, outside the 1-4 MiB band`)
  }

  let provider: { destroy: () => void } | null = null
  if (mode === 'held') {
    const open = await makeOpenProvider(hop.port)(documentId, slug, '')
    if (!open.synced) throw new Error('the held-room provider never synced')
    provider = open.provider
  }

  const before = await Promise.all(scraped.map((p) => scrape(p.metricsUrl)))
  const rowsBefore = await prisma.documents.count({ where: { documentId } })
  const logOffset = statSync(logFile).size
  const lagMax = new Map<string, number>()
  const lagTimer = setInterval(async () => {
    for (const instance of ws) {
      const value = (await scrape(instance.metricsUrl)).get('nodejs_eventloop_lag_max_seconds') ?? 0
      lagMax.set(instance.label, Math.max(lagMax.get(instance.label) ?? 0, value))
    }
  }, 5000)

  const calls: { readMs: number; applyMs: number; totalMs: number; status: string }[] = []
  for (let i = 0; i < writes; i++) {
    const started = performance.now()
    const read = await client.read(documentId)
    const readDone = performance.now()
    if (read.status !== 'ok') throw new Error(`read ${i} failed: ${read.status}`)

    // Mirror edit_blocks: a fresh read, the section's own rev, one block replaced.
    const ids = sectionIds(read.content as never)
    const sectionId = ids[(i * 37) % ids.length]
    const section = findSection(read.content, sectionId)
    if (!section) throw new Error(`section ${sectionId} not found`)
    const edit = nextEdit(rand, section.end - section.start)
    const outcome = await client.apply({
      documentId,
      mode: 'blocks',
      sectionId,
      rev: section.rev,
      from: edit.from,
      to: edit.from + 1,
      content: { type: 'doc', content: [paragraph(edit.text)] } as never,
      actor: ACTOR
    })
    const done = performance.now()
    calls.push({
      readMs: round1(readDone - started),
      applyMs: round1(done - readDone),
      totalMs: round1(done - started),
      status: outcome.status
    })
    if (gapMs > 0) await sleep(gapMs)
  }

  clearInterval(lagTimer)
  provider?.destroy()
  // Let a held room's 10 s idle debounce fire, then wait for every save to land.
  await sleep(12_000)
  await waitForDrain()
  const after = await Promise.all(scraped.map((p) => scrape(p.metricsUrl)))
  const rowsAfter = await prisma.documents.count({ where: { documentId } })
  const orphanStateKeys = await takeOrphanStateKeys()
  // The offset is in bytes, and the log holds multi-byte text, so slice the bytes.
  const clashes = readFileSync(logFile)
    .subarray(logOffset)
    .toString('utf8')
    .split('\n')
    .filter((line) => /P2002|Unique constraint/.test(line)).length

  const outcomes: Record<string, number> = {}
  for (const call of calls) outcomes[call.status] = (outcomes[call.status] ?? 0) + 1
  const storeHooks = histogram(before, after, 'document_persist_duration_seconds')
  const isStoreQueue = (k: string) => k.includes('queue="store-documents"')
  const jobDurations = histogram(before, after, 'job_duration_seconds', isStoreQueue)
  const storeHookCount = storeHooks.at(-1)?.[1] ?? 0
  const failedAttempts = delta(
    before,
    after,
    (k) => k.startsWith('jobs_total{') && isStoreQueue(k) && k.includes('status="failed"')
  )
  const completedJobs = delta(
    before,
    after,
    (k) => k.startsWith('jobs_total{') && isStoreQueue(k) && k.includes('status="completed"')
  )
  const coldOpens = delta(before, after, (k) =>
    k.startsWith('document_load_duration_seconds_count')
  )
  const fallbackWrites = delta(before, after, (k) =>
    k.startsWith('document_persist_fallback_total')
  )
  const onRoute = (route: string) => (k: string) => k.includes(`route="${route}"`)
  const applyPath = onRoute('/internal/documents/:documentId/content')
  const readPath = onRoute('/internal/documents/:documentId/content/live')
  const applyRoute = histogram(before, after, 'http_request_duration_seconds', applyPath)
  const readRoute = histogram(before, after, 'http_request_duration_seconds', readPath)
  const rowsAdded = rowsAfter - rowsBefore

  const result = {
    run,
    mode,
    fixture: {
      sections: fixture.sections.length,
      jsonBytes: fixtureJsonBytes,
      storedBytes,
      version: head?.version,
      seedOrphanKeys: seedOrphans.count
    },
    writes: {
      n: calls.length,
      outcomes,
      readMs: stats(calls.map((c) => c.readMs)),
      applyMs: stats(calls.map((c) => c.applyMs)),
      totalMs: stats(calls.map((c) => c.totalMs)),
      calls
    },
    server: {
      storeHooks: {
        n: storeHookCount,
        perWrite: calls.length ? Math.round((storeHookCount / calls.length) * 100) / 100 : null,
        meanSeconds: meanOf(before, after, 'document_persist_duration_seconds'),
        bucketP50: quantile(storeHooks, 0.5),
        bucketP99: quantile(storeHooks, 0.99),
        buckets: storeHooks
      },
      storeJobs: {
        completed: completedJobs,
        failedAttempts,
        meanSeconds: meanOf(before, after, 'job_duration_seconds', isStoreQueue),
        bucketP50: quantile(jobDurations, 0.5),
        bucketP95: quantile(jobDurations, 0.95)
      },
      clashesInLog: clashes,
      fallbackWrites,
      orphanStateKeys,
      rowsAdded,
      rowsPerWrite: calls.length ? Math.round((rowsAdded / calls.length) * 100) / 100 : null,
      coldOpens,
      coldOpensPerWrite: calls.length ? Math.round((coldOpens / calls.length) * 100) / 100 : null,
      wsApplyRoute: {
        n: applyRoute.at(-1)?.[1] ?? 0,
        meanSeconds: meanOf(before, after, 'http_request_duration_seconds', applyPath),
        bucketP50: quantile(applyRoute, 0.5),
        bucketP95: quantile(applyRoute, 0.95)
      },
      wsReadRoute: {
        n: readRoute.at(-1)?.[1] ?? 0,
        meanSeconds: meanOf(before, after, 'http_request_duration_seconds', readPath),
        bucketP50: quantile(readRoute, 0.5),
        bucketP95: quantile(readRoute, 0.95)
      },
      eventLoopLagMaxSeconds: Object.fromEntries(lagMax)
    }
  }
  results.push(result)
  console.log(
    `run ${run} (${mode}): ${calls.length} writes, total p50 ${result.writes.totalMs?.p50} ms, p95 ` +
      `${result.writes.totalMs?.p95} ms; rows/write ${result.server.rowsPerWrite}; ` +
      `failed attempts ${failedAttempts}; cold opens ${coldOpens}; fallbacks ${fallbackWrites}; ` +
      `orphan keys ${orphanStateKeys.count} (${(orphanStateKeys.bytes / 2 ** 20).toFixed(1)} MiB)`
  )
  if (fallbackWrites > 0) {
    console.warn(`run ${run}: ${fallbackWrites} saves took the queue-down fallback, not the queue`)
  }
  await prisma.documentMetadata.delete({ where: { documentId } })
}

const git = (cmd: string[]) =>
  Bun.spawnSync(['git', ...cmd])
    .stdout.toString()
    .trim()
const report = {
  benchmark: 'bench-content-write (#726)',
  where:
    'local stack, one machine: 2 hocuspocus-server + 2 hocuspocus-worker in production mode, Redis extension on',
  startedAt: stamp,
  commit: git(['rev-parse', 'HEAD']),
  dirty: git(['status', '--porcelain']).split('\n').filter(Boolean),
  bun: Bun.version,
  machine: {
    cpu: os.cpus()[0]?.model,
    cpus: os.cpus().length,
    memGiB: Math.round(os.totalmem() / 2 ** 30),
    platform: `${os.platform()} ${os.release()}`,
    loadAvg: { start: loadAtStart, end: os.loadavg() }
  },
  condition: `${mode} room, ${gapMs > 0 ? `${gapMs} ms between writes` : 'writes back to back'}`,
  note:
    'Client timings (ms) and meanSeconds are exact. bucketP* values estimate inside one ' +
    "bucket, as Grafana's histogram_quantile does; use them only to compare with Grafana.",
  options: {
    mode,
    writes,
    runs,
    gapMs,
    redisDb,
    targetMiB: targetBytes / 2 ** 20,
    seed,
    workerConcurrency: WORKER_CONCURRENCY
  },
  results
}
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(`wrote ${outPath} (process logs: ${logFile})`)

await cleanup()
await redis.flushdb()
await redis.quit()
proxy.close()
await prisma.$disconnect()
stopAll()
process.exit(0)
