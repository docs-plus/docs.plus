/**
 * #737 probe: peak worker RSS while 4 large store jobs wait, on 2 production-mode workers.
 * Run from apps/hocuspocus.server: bun --env-file=../../.env.local scripts/bench-store-rss.ts
 * Options: --concurrency 10, --workers 2, --runs 5, --large 4, --target-mib 10.47, --seed 737,
 * --redis-db 10, --sample-ms 50, --out <file>. Each run starts fresh workers, so no heap carries over.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'

import { TiptapTransformer } from '@hocuspocus/transformer'
import Redis from 'ioredis'
import * as Y from 'yjs'

import { buildFixture, mulberry32 } from './lib/benchFixture'
import { appendParagraph, sleep } from './lib/e2eHarness'
import { spawnWorker, startPgTlsProxy, type WorkerProcess } from './lib/prodModeStack'

const args = process.argv.slice(2)
const option = (name: string, fallback: string) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : args[at + 1]
}
const concurrency = Number(option('--concurrency', '10'))
const workerCount = Number(option('--workers', '2'))
const runs = Number(option('--runs', '5'))
const largeJobs = Number(option('--large', '4'))
// 10.47 MiB of fixture text encodes to a 12,518,535 B state, next to the #737 heads.
const targetMiB = Number(option('--target-mib', '10.47'))
const seed = Number(option('--seed', '737'))
const redisDb = Number(option('--redis-db', '10'))
const sampleMs = Number(option('--sample-ms', '50'))
for (const [name, value] of Object.entries({ concurrency, workerCount, runs, largeJobs })) {
  if (!(Number.isInteger(value) && value > 0))
    throw new Error(`${name} must be a whole number above 0`)
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outPath = option('--out', join(os.tmpdir(), `bench-store-rss-c${concurrency}-${stamp}.json`))
const logBase = outPath.replace(/\.json$/, '')

// This process only queues jobs. `test` keeps its pool off TLS. Config freezes on import,
// so the Redis DB is set before the dynamic imports.
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'warn'
process.env.REDIS_DB = String(redisDb)
const { prisma } = await import('../src/lib/prisma')
const { enqueueStoreDocument, StoreDocumentQueue, closeQueues } = await import('../src/lib/queue')
const { migrationExtensions } = await import('../src/lib/migration-extensions')
// The workers inherit this. Their "Document stored successfully" line names the job,
// and each worker writes its own log, so the log tells which worker ran which job.
process.env.QUEUE_LOG_LEVEL = 'info'

const SLUG_PREFIX = 'bench-store-rss-'
const ACTOR_ID = '00000000-0000-4000-8000-000000000737'
const MiB = 2 ** 20
const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const round1 = (v: number) => Math.round(v * 10) / 10
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const spread = (values: number[]) =>
  values.length === 0
    ? null
    : {
        n: values.length,
        median: round1(median(values)),
        min: Math.min(...values),
        max: Math.max(...values)
      }

// --- States. Each large save is the head plus one new paragraph, as a live room sends.
const largeFixture = buildFixture(mulberry32(seed), Math.round(targetMiB * MiB))
const smallFixture = buildFixture(mulberry32(seed + 1), 20 * 1024)
// toYdoc gives each build a random client id, and its varint width moves the state by
// about 100 kB. Cloning into a doc with a fixed id makes the bytes the same every time.
const HEAD_CLIENT_ID = 3_737_000_000
const EDIT_CLIENT_ID = 3_737_000_001
const toState = (json: object) => {
  const source = TiptapTransformer.toYdoc(json, 'default', migrationExtensions)
  const ydoc = new Y.Doc()
  ydoc.clientID = HEAD_CLIENT_ID
  const nodes = source.getXmlFragment('default').toArray() as Y.XmlElement[]
  ydoc.getXmlFragment('default').insert(
    0,
    nodes.map((node) => node.clone())
  )
  const state = Y.encodeStateAsUpdate(ydoc)
  source.destroy()
  ydoc.destroy()
  return state
}
const largeHead = toState(largeFixture.doc)
const smallHead = toState(smallFixture.doc)
const withEdit = (head: Uint8Array, text: string) => {
  const ydoc = new Y.Doc()
  ydoc.clientID = EDIT_CLIENT_ID
  Y.applyUpdate(ydoc, head)
  appendParagraph(ydoc, text)
  const state = Y.encodeStateAsUpdate(ydoc)
  ydoc.destroy()
  return Buffer.from(state)
}

// --- Stack: a TLS proxy and an empty Redis DB. Workers start per run.
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
let workers: WorkerProcess[] = []
process.once('exit', () => {
  for (const worker of workers) worker.proc.kill('SIGKILL')
})
process.once('SIGINT', () => process.exit(130))
process.once('SIGTERM', () => process.exit(143))

const stopWorkers = async () => {
  for (const worker of workers) worker.proc.kill('SIGTERM')
  const exited = Promise.all(workers.map((worker) => worker.proc.exited))
  if ((await Promise.race([exited.then(() => true), sleep(15_000).then(() => false)])) === false) {
    for (const worker of workers) worker.proc.kill('SIGKILL')
    await exited
  }
  workers = []
}

// macOS has no /proc, so ps reads each worker's RSS (KiB) from outside the process.
const readRss = async (pids: number[]) => {
  const ps = Bun.spawn(['ps', '-o', 'pid=,rss=', '-p', pids.join(',')], { stdout: 'pipe' })
  const out = await new Response(ps.stdout).text()
  const rss = new Map<number, number>()
  for (const line of out.trim().split('\n')) {
    const [pid, kib] = line.trim().split(/\s+/).map(Number)
    if (Number.isFinite(pid) && Number.isFinite(kib)) rss.set(pid, kib * 1024)
  }
  return rss
}

const startSampler = (pool: WorkerProcess[]) => {
  const peak = new Map<string, number>()
  const series: { t: number; rss: Record<string, number> }[] = []
  let running = true
  const started = Date.now()
  const done = (async () => {
    while (running) {
      const rss = await readRss(pool.map((w) => w.proc.pid))
      const row: Record<string, number> = {}
      for (const worker of pool) {
        const bytes = rss.get(worker.proc.pid)
        if (bytes === undefined) continue
        row[worker.label] = bytes
        peak.set(worker.label, Math.max(peak.get(worker.label) ?? 0, bytes))
      }
      series.push({ t: Date.now() - started, rss: row })
      await sleep(sampleMs)
    }
  })()
  return {
    stop: async () => {
      running = false
      await done
      const elapsed = Date.now() - started
      return {
        peak,
        series,
        samples: series.length,
        meanGapMs: round1(elapsed / Math.max(series.length, 1))
      }
    }
  }
}

// Which worker logged each job as stored. Offsets are bytes, so slice the bytes.
const storedBy = (offsets: Map<string, number>) => {
  const owner = new Map<string, string>()
  const errors: Record<string, number> = {}
  for (const worker of workers) {
    const text = readFileSync(`${logBase}.${worker.label}.log`)
      .subarray(offsets.get(worker.label) ?? 0)
      .toString('utf8')
    for (const line of text.split('\n')) {
      if (!line.startsWith('{')) continue
      try {
        const entry = JSON.parse(line) as { msg?: string; jobId?: string }
        if (entry.msg === 'Document stored successfully' && entry.jobId)
          owner.set(entry.jobId, worker.label)
        if (entry.msg === 'Error storing data for job')
          errors[worker.label] = (errors[worker.label] ?? 0) + 1
      } catch {
        // A line that is not JSON is not a job line.
      }
    }
  }
  return { owner, errors }
}
const logOffsets = () =>
  new Map(
    workers.map((w) => {
      try {
        return [w.label, readFileSync(`${logBase}.${w.label}.log`).byteLength] as const
      } catch {
        return [w.label, 0] as const
      }
    })
  )

const readJob = async (id: string) => {
  const job = await StoreDocumentQueue.getJob(id)
  if (!job) return null
  return {
    id,
    timestamp: job.timestamp,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason || null,
    state: await job.getState()
  }
}
type JobRecord = NonNullable<Awaited<ReturnType<typeof readJob>>>
const waitForJobs = async (ids: string[], timeoutMs = 300_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const jobs = await Promise.all(ids.map(readJob))
    if (jobs.every((job) => job?.state === 'completed' || job?.state === 'failed')) {
      return jobs as JobRecord[]
    }
    await sleep(100)
  }
  throw new Error(`jobs never finished: ${ids.join(', ')}`)
}
const waitForStart = async (id: string, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await readJob(id))?.processedOn) return
    await sleep(20)
  }
  throw new Error(`job ${id} never started`)
}

const enqueue = (jobId: string, documentId: string, slug: string, state: Buffer) =>
  enqueueStoreDocument({
    jobId,
    documentName: documentId,
    state,
    context: { slug },
    commitMessage: '',
    trigger: 'websocket',
    triggeredBy: null,
    contributors: []
  })

const cleanup = () =>
  prisma.documentMetadata.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } })
await cleanup()

const newPad = async (run: number, name: string, head: Uint8Array) => {
  const documentId = `bench737r${run}${name}${stamp.replace(/[^0-9]/g, '')}`
  const slug = `${SLUG_PREFIX}${stamp}-${run}-${name}`
  await prisma.documentMetadata.create({
    data: { documentId, slug, title: 'Bench document', ownerId: ACTOR_ID }
  })
  await prisma.documents.create({
    data: { documentId, version: 1, data: Buffer.from(head), commitMessage: '', contributors: [] }
  })
  return { documentId, slug }
}

const wait = (job: JobRecord) => (job.processedOn ? job.processedOn - job.timestamp : null)
const took = (job: JobRecord) =>
  job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : null

const results = []
for (let run = 1; run <= runs; run++) {
  // Phase A pads: 4 large ones and 1 small one. Phase B reuses large pad 1 and the small pad.
  const large = []
  for (let i = 1; i <= largeJobs; i++) large.push(await newPad(run, `L${i}`, largeHead))
  const small = await newPad(run, 'S', smallHead)
  const largeStates = large.map((_, i) => withEdit(largeHead, `run ${run} large save ${i + 1}`))
  const largeStateB = withEdit(largeHead, `run ${run} large save B`)
  const smallStateA = withEdit(smallHead, `run ${run} small save A`)
  const smallStateB = withEdit(smallHead, `run ${run} small save B`)

  for (let w = 1; w <= workerCount; w++) {
    const label = `W${w}`
    const base = { databaseUrl: proxy.url, redisDb, logFile: `${logBase}.${label}.log` }
    workers.push(await spawnWorker(label, base, concurrency))
  }
  // Let boot work settle, then take the idle RSS.
  await sleep(3000)
  const idle = await readRss(workers.map((w) => w.proc.pid))
  const idleMiB = Object.fromEntries(
    workers.map((w) => [w.label, round1((idle.get(w.proc.pid) ?? 0) / MiB)])
  )
  const loadStart = os.loadavg()
  const offsetsA = logOffsets()

  // --- Phase A: 4 large saves, then 1 small save right behind them.
  const sampler = startSampler(workers)
  const idsA = large.map((_, i) => `bench737-r${run}-large${i + 1}`)
  const smallIdA = `bench737-r${run}-smallA`
  await Promise.all(
    large.map((pad, i) => enqueue(idsA[i], pad.documentId, pad.slug, largeStates[i]))
  )
  await enqueue(smallIdA, small.documentId, small.slug, smallStateA)
  const jobsA = await waitForJobs([...idsA, smallIdA])
  // Keep sampling for 3 s, so a late peak (GC, the card write) is not cut off.
  await sleep(3000)
  const phaseA = await sampler.stop()
  const ownersA = storedBy(offsetsA)

  // --- Phase B: 1 large save runs, then a small save. Needs a free worker, so 2 workers.
  await sleep(2000)
  const offsetsB = logOffsets()
  const largeIdB = `bench737-r${run}-largeB`
  const smallIdB = `bench737-r${run}-smallB`
  await enqueue(largeIdB, large[0].documentId, large[0].slug, largeStateB)
  await waitForStart(largeIdB)
  await enqueue(smallIdB, small.documentId, small.slug, smallStateB)
  const [largeB, smallB] = await waitForJobs([largeIdB, smallIdB])
  const ownersB = storedBy(offsetsB)
  const loadEnd = os.loadavg()
  await stopWorkers()

  const largeA = jobsA.slice(0, largeJobs)
  const smallA = jobsA[largeJobs]
  const split: Record<string, number> = {}
  for (const worker of phaseA.peak.keys()) split[worker] = 0
  for (const job of largeA) {
    const owner = ownersA.owner.get(job.id) ?? 'unknown'
    split[owner] = (split[owner] ?? 0) + 1
  }
  const peakMiB = Object.fromEntries([...phaseA.peak].map(([k, v]) => [k, round1(v / MiB)]))
  // The busiest worker ran the most large jobs; on a tie, take the higher peak.
  const busiest = Object.keys(split)
    .filter((k) => k !== 'unknown')
    .sort((a, b) => split[b] - split[a] || (peakMiB[b] ?? 0) - (peakMiB[a] ?? 0))[0]
  // BullMQ counts the successful attempt too, so a clean completed job reads 1.
  const failedAttempts = [...jobsA, largeB, smallB].reduce(
    (sum, job) => sum + job.attemptsMade - (job.state === 'completed' ? 1 : 0),
    0
  )

  const result = {
    run,
    loadAvg: { start: loadStart, end: loadEnd },
    idleRssMiB: idleMiB,
    phaseA: {
      peakRssMiB: peakMiB,
      fleetPeakMiB: Math.max(...Object.values(peakMiB)),
      busiestWorker: busiest,
      busiestPeakMiB: peakMiB[busiest] ?? null,
      largeJobSplit: split,
      sampler: { samples: phaseA.samples, meanGapMs: phaseA.meanGapMs },
      largeJobs: largeA.map((job) => ({
        id: job.id,
        worker: ownersA.owner.get(job.id) ?? 'unknown',
        state: job.state,
        waitMs: wait(job),
        runMs: took(job),
        attemptsMade: job.attemptsMade
      })),
      smallJob: {
        worker: ownersA.owner.get(smallA.id) ?? 'unknown',
        state: smallA.state,
        waitMs: wait(smallA),
        runMs: took(smallA)
      },
      rssSeries: phaseA.series
    },
    phaseB: {
      largeJob: {
        worker: ownersB.owner.get(largeB.id) ?? 'unknown',
        state: largeB.state,
        waitMs: wait(largeB),
        runMs: took(largeB)
      },
      smallJob: {
        worker: ownersB.owner.get(smallB.id) ?? 'unknown',
        state: smallB.state,
        waitMs: wait(smallB),
        runMs: took(smallB),
        // True when the small job started before the large one finished.
        overlapped:
          smallB.processedOn !== null &&
          largeB.finishedOn !== null &&
          smallB.processedOn < largeB.finishedOn
      }
    },
    failedAttempts,
    workerErrors: { ...ownersA.errors, ...ownersB.errors }
  }
  results.push(result)
  console.log(
    `run ${run} (c${concurrency}): fleet peak ${result.phaseA.fleetPeakMiB} MiB, busiest ${busiest} ` +
      `${result.phaseA.busiestPeakMiB} MiB, split ${JSON.stringify(split)}, small wait A ` +
      `${result.phaseA.smallJob.waitMs} ms, small wait B ${result.phaseB.smallJob.waitMs} ms ` +
      `(overlap ${result.phaseB.smallJob.overlapped}), failed attempts ${failedAttempts}`
  )
  await cleanup()
  await redis.flushdb()
}

const git = (cmd: string[]) =>
  Bun.spawnSync(['git', ...cmd])
    .stdout.toString()
    .trim()
const fileSha = (relative: string) => sha256(readFileSync(new URL(relative, import.meta.url)))
const report = {
  benchmark: 'bench-store-rss (#737)',
  where: `local, one machine: ${workerCount} hocuspocus-worker processes in production mode`,
  startedAt: stamp,
  commit: git(['rev-parse', 'HEAD']),
  dirty: git(['status', '--porcelain']).split('\n').filter(Boolean),
  bun: Bun.version,
  scriptSha256: fileSha('./bench-store-rss.ts'),
  benchFixtureSha256: fileSha('./lib/benchFixture.ts'),
  prodModeStackSha256: fileSha('./lib/prodModeStack.ts'),
  machine: {
    cpu: os.cpus()[0]?.model,
    cpus: os.cpus().length,
    memGiB: Math.round(os.totalmem() / 2 ** 30),
    platform: `${os.platform()} ${os.release()}`
  },
  options: { concurrency, workerCount, runs, largeJobs, targetMiB, seed, redisDb, sampleMs },
  states: {
    largeHeadBytes: largeHead.byteLength,
    largeHeadSha256: sha256(largeHead),
    largeSaveBytes: withEdit(largeHead, 'size check').byteLength,
    smallHeadBytes: smallHead.byteLength,
    sections: largeFixture.sections.length
  },
  note:
    'RSS comes from ps, outside the worker. Each large save merges with a stored head of the same ' +
    'size. Phase A queues the large saves and then 1 small save. Phase B runs 1 large save, then ' +
    'queues 1 small save once the large one is active. Wait is processedOn minus timestamp.',
  summary: {
    fleetPeakMiB: spread(results.map((r) => r.phaseA.fleetPeakMiB)),
    busiestPeakMiB: spread(results.map((r) => r.phaseA.busiestPeakMiB ?? 0)),
    largeJobSplits: results.map((r) => r.phaseA.largeJobSplit),
    largeJobRunMs: spread(results.flatMap((r) => r.phaseA.largeJobs.map((j) => j.runMs ?? 0))),
    smallWaitBehindLargeQueueMs: spread(results.map((r) => r.phaseA.smallJob.waitMs ?? 0)),
    smallWaitBehindOneLargeMs: spread(results.map((r) => r.phaseB.smallJob.waitMs ?? 0)),
    smallOverlappedLarge: results.map((r) => r.phaseB.smallJob.overlapped),
    failedAttempts: results.reduce((sum, r) => sum + r.failedAttempts, 0)
  },
  results
}
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(`wrote ${outPath} (worker logs: ${logBase}.W*.log)`)
console.log(JSON.stringify(report.summary))

await cleanup()
await redis.flushdb()
await redis.quit()
await closeQueues()
proxy.close()
await prisma.$disconnect()
process.exit(0)
