/**
 * Measures cross-replica sync for #595: two production-mode WS processes on one
 * Redis, one writer on each, one document. A measurement tool, not a test.
 * Run from apps/hocuspocus.server:
 *   bun --env-file=../../.env.local scripts/redis-sync-probe.ts --mode publishes
 *   bun --env-file=../../.env.local scripts/redis-sync-probe.ts --mode convergence
 *   bun --env-file=../../.env.local scripts/redis-sync-probe.ts --mode saved (#758)
 * Options: --fixture <Y update file>, --edits 20, --rounds 30, --step-ms 10, --burst-ms 0, --redis-db 7.
 * --fixture-seed 726 builds the #726 bench text in place of --fixture (3,571,053 B, same bytes each run).
 * Saved mode: --saves 20, --gap-ms 30000 (0 skips the drop check), --gap-saves 3, --log-dir <dir>.
 *   bun --env-file=../../.env.local scripts/redis-sync-probe.ts --mode rows (#703)
 * Rows mode: --instances 2, --typers 1, --sockets <instances>, --cps 5, --minutes 10,
 * --fixture-bytes 2048 (built from seed 7 unless --fixture or --fixture-seed), --concurrency 1,
 * --count-locks true, --stagger-ms <60000 / typers>.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { TiptapTransformer } from '@hocuspocus/transformer'
import type { Subprocess } from 'bun'
import Redis from 'ioredis'
import * as Y from 'yjs'

import { migrationExtensions } from '../src/lib/migration-extensions'
import { buildFixture, mulberry32 } from './lib/benchFixture'
import { freePort, makeOpenProvider, sleep } from './lib/e2eHarness'
import { spawnWorker, spawnWs, startPgTlsProxy } from './lib/prodModeStack'

// Before the dynamic import: `production` turns on TLS in this process's pool.
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'warn'
const { prisma } = await import('../src/lib/prisma')

const REPO_ROOT = new URL('../../..', import.meta.url).pathname
// The 5.36 MB edited fixture the 2026-10-23 baseline used. Notes/ is local-only.
const DEFAULT_FIXTURE = `${REPO_ROOT}Notes/local-docs/2026-10-23-perf-harness/redis-syncstep2-full-walk-per-edit/out/fixtures/real-5357733-c1.bin`
const PROBE_PREFIX = 'redis-sync-probe-'
const PROBE_TEXT = 'redis-sync-probe:'

const args = process.argv.slice(2)
const option = (name: string, fallback: string) => {
  const at = args.indexOf(name)
  return at === -1 ? fallback : args[at + 1]
}
const mode = option('--mode', 'publishes')
if (mode !== 'publishes' && mode !== 'convergence' && mode !== 'saved' && mode !== 'rows') {
  throw new Error(`unknown --mode ${mode}`)
}
const edits = Number(option('--edits', '20'))
const rounds = Number(option('--rounds', '30'))
const redisDb = Number(option('--redis-db', '7'))
const stepMs = Number(option('--step-ms', '10'))
// Publishes mode: 0 waits for each edit to land; above 0 types the edits that many ms apart.
const burstMs = Number(option('--burst-ms', '0'))
const fixturePath = option('--fixture', DEFAULT_FIXTURE)
const fixtureSeed = args.includes('--fixture-seed') ? Number(option('--fixture-seed', '')) : null
if (fixtureSeed !== null && !Number.isInteger(fixtureSeed)) throw new Error('bad --fixture-seed')
if (fixtureSeed !== null && args.includes('--fixture')) {
  throw new Error('pass --fixture or --fixture-seed, not both')
}
const saves = Number(option('--saves', '20'))
const gapMs = Number(option('--gap-ms', '30000'))
const gapSaves = Number(option('--gap-saves', '3'))
const logDir = option('--log-dir', '')
const instanceCount = Number(option('--instances', '2'))
const typerCount = Number(option('--typers', '1'))
const socketCount = Number(option('--sockets', String(instanceCount)))
const cps = Number(option('--cps', '5'))
const minutes = Number(option('--minutes', '10'))
const fixtureBytes = Number(option('--fixture-bytes', '2048'))
const workerConcurrency = Number(option('--concurrency', '1'))
const countLocks = option('--count-locks', 'true') === 'true'
// 60 s is the store hook's maxDebounce, so the typers' save clocks spread evenly.
const staggerMs = Number(option('--stagger-ms', String(Math.round(60_000 / typerCount))))
if (!(instanceCount >= 2 && typerCount >= 1 && typerCount <= instanceCount)) {
  throw new Error('need --instances 2 or more and --typers between 1 and --instances')
}
if (socketCount < instanceCount) throw new Error('--sockets must cover one per instance')

/** Typing and backspacing, so the fixture carries a real delete set. */
const buildEditedFixture = (targetBytes: number, opsPerParagraph = 2000): Uint8Array => {
  const doc = new Y.Doc()
  const fragment = doc.getXmlFragment('default')
  let text = new Y.XmlText()
  let seed = 7
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  while (Y.encodeStateAsUpdate(doc).length < targetBytes) {
    const paragraph = new Y.XmlElement('paragraph')
    text = new Y.XmlText()
    paragraph.insert(0, [text])
    fragment.push([paragraph])
    for (let i = 0; i < opsPerParagraph; i++) {
      if (rand() < 0.3 && text.length > 0) doc.transact(() => text.delete(text.length - 1, 1))
      else doc.transact(() => text.insert(text.length, 'abcdefgh '[i % 9]))
    }
  }
  return Y.encodeStateAsUpdate(doc)
}

/**
 * buildFixture(mulberry32(seed), 3 MiB) from benchFixture.ts, as the #726 runs used. Not the
 * bench-content-write.ts text: that seeds each run with seed + run. A fixed 32-bit client ID
 * gives the same bytes every run (seed 726: 3,571,053 B).
 */
const buildBenchFixture = (seed: number): Uint8Array => {
  const { doc } = buildFixture(mulberry32(seed), 3 * 1024 * 1024)
  const built = TiptapTransformer.toYdoc(doc, 'default', migrationExtensions)
  const fixed = new Y.Doc()
  fixed.clientID = 2 ** 31 + seed
  // y-prosemirror writes only elements at the root, never a hook.
  const nodes = built.getXmlFragment('default').toArray() as Y.XmlElement[]
  fixed.getXmlFragment('default').insert(
    0,
    nodes.map((node) => node.clone())
  )
  return Y.encodeStateAsUpdate(fixed)
}

// Rows mode (#703) never reads Notes/: its default is built from the fixed seed. 100 ops per
// paragraph lands the 2 KB target at 2,122 B.
const builtRows = mode === 'rows' && fixtureSeed === null && !args.includes('--fixture')
const fixture =
  fixtureSeed !== null
    ? buildBenchFixture(fixtureSeed)
    : builtRows
      ? buildEditedFixture(fixtureBytes, 100)
      : existsSync(fixturePath)
        ? new Uint8Array(readFileSync(fixturePath))
        : buildEditedFixture(1_000_000)
const fixtureLabel =
  fixtureSeed !== null
    ? `built: #726 bench text, seed ${fixtureSeed}, 3 MiB`
    : builtRows
      ? `built: seed 7, ${fixtureBytes} B target`
      : existsSync(fixturePath)
        ? fixturePath
        : 'built: type and delete'

const scratch = mkdtempSync(join(tmpdir(), 'redis-sync-probe-'))
const pgProxy = await startPgTlsProxy(process.env.DATABASE_URL ?? '')

// --- Redis: a probe DB the dev worker never drains, and a channel subscriber.
const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined
}
const admin = new Redis({ ...redisOptions, db: redisDb })
const keysBefore = new Set(await admin.keys('*'))

const documentId = `${PROBE_PREFIX}${Date.now()}`
const channel = `hocuspocus:${documentId}`

interface Frame {
  at: number
  source: string
  kind: string
  bytes: number
}
const frames: Frame[] = []
const identifiers = new Map<string, string>()
let nextLabel = ''

const readVarUint = (buf: Buffer, cursor: { at: number }) => {
  let value = 0
  let scale = 1
  for (;;) {
    const byte = buf[cursor.at++]
    value += (byte & 127) * scale
    if (byte < 128) return value
    scale *= 128
  }
}
const TYPES = ['Sync', 'Awareness', 'Auth', 'QueryAwareness', 'SyncReply', 'Stateless', 'Broadcast']
const SYNC_STEPS = ['SS1', 'SS2', 'Update']

// Frame layout: [idLen][id][varString document][varUint type][varUint sync step].
const classify = (buf: Buffer) => {
  const identifier = buf.toString('utf8', 1, 1 + buf[0])
  const cursor = { at: 1 + buf[0] }
  const nameLength = readVarUint(buf, cursor)
  cursor.at += nameLength
  const type = readVarUint(buf, cursor)
  let kind = TYPES[type] ?? `type${type}`
  if (type === 0 || type === 4) kind += `/${SYNC_STEPS[readVarUint(buf, cursor)] ?? '?'}`
  return { identifier, kind }
}

const subscriber = new Redis(redisOptions)
await subscriber.subscribe(channel)
subscriber.on('messageBuffer', (_channel: Buffer, data: Buffer) => {
  const { identifier, kind } = classify(data)
  // A new identifier is the instance whose writer just connected (its afterLoadDocument).
  if (!identifiers.has(identifier)) identifiers.set(identifier, nextLabel || 'unknown')
  frames.push({
    at: performance.now(),
    source: identifiers.get(identifier)!,
    kind,
    bytes: data.length
  })
})

// --- Saved mode: A reaches Redis through this proxy, so the drop check can cut A's
// save subscriber alone. Its psubscribe names this pattern; no other client sends it.
const SUBSCRIBER_PATTERN = 'doc:*:saved'
const redisProxy = {
  refusing: false,
  subscribers: new Set<net.Socket>(),
  onSubscriber: null as null | (() => void)
}
const redisProxyServer = net.createServer((client) => {
  if (redisProxy.refusing) return void client.destroy()
  const upstream = net.connect(redisOptions.port, redisOptions.host)
  const close = () => {
    redisProxy.subscribers.delete(client)
    client.destroy()
    upstream.destroy()
  }
  for (const socket of [client, upstream]) socket.on('error', close).on('close', close)
  client.on('data', (chunk: Buffer) => {
    if (!redisProxy.subscribers.has(client) && chunk.includes(SUBSCRIBER_PATTERN)) {
      redisProxy.subscribers.add(client)
      redisProxy.onSubscriber?.()
    }
    upstream.write(chunk)
  })
  upstream.on('data', (chunk: Buffer) => client.write(chunk))
})
const redisProxyPort = freePort()
if (mode === 'saved') {
  await new Promise<void>((resolve) =>
    redisProxyServer.listen(redisProxyPort, '127.0.0.1', resolve)
  )
}

// --- Production-mode WS processes: two, or --instances. A restart takes new ports.
interface Instance {
  label: string
  port: number
  metricsUrl: string
  proc: Subprocess | null
  env: Record<string, string>
}
const instances: Instance[] = Array.from({ length: instanceCount }, (_, i) =>
  String.fromCharCode(65 + i)
).map((label) => ({ label, port: 0, metricsUrl: '', proc: null, env: {} }))
if (mode === 'saved') {
  instances[0].env = { REDIS_HOST: '127.0.0.1', REDIS_PORT: String(redisProxyPort) }
}

const start = async (instance: Instance) => {
  const logFile = join(logDir || scratch, `${instance.label}.log`)
  // Step 5 of #758 reads the reconnect warn lines from these logs.
  const env = { ...instance.env, ...(logDir ? { REDIS_LOG_LEVEL: 'warn' } : {}) }
  const ws = await spawnWs(instance.label, { databaseUrl: pgProxy.url, redisDb, logFile }, env)
  Object.assign(instance, { port: ws.port, metricsUrl: ws.metricsUrl, proc: ws.proc })
}

const stopAll = () => {
  for (const instance of instances) instance.proc?.kill('SIGKILL')
}
process.once('exit', stopAll)

const openWriter = async (instance: Instance) => {
  nextLabel = instance.label
  const before = frames.length
  const writer = await makeOpenProvider(instance.port)(documentId, documentId, '')
  if (!writer.synced) throw new Error(`writer on ${instance.label} never synced`)
  // The instance's afterLoadDocument SyncStep1 proves RedisExtension publishes.
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (frames.slice(before).some((f) => f.source === instance.label && f.kind === 'Sync/SS1')) {
      return writer
    }
    await sleep(50)
  }
  throw new Error(`no SyncStep1 from ${instance.label} on ${channel}; counts would read zero`)
}

const probeText = (ydoc: Y.Doc): Y.XmlText | null => {
  const fragment = ydoc.getXmlFragment('default')
  const last = fragment.length > 0 ? fragment.get(fragment.length - 1) : null
  const text = last instanceof Y.XmlElement ? last.get(0) : null
  return text instanceof Y.XmlText && text.toString().startsWith(PROBE_TEXT) ? text : null
}

const waitFor = async (accept: () => boolean, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (accept()) return true
    await sleep(25)
  }
  return accept()
}

const insertMarker = (ydoc: Y.Doc, marker: string): number => {
  const text = probeText(ydoc)
  if (!text) throw new Error('probe paragraph missing')
  let updateBytes = 0
  ydoc.once('update', (update: Uint8Array) => {
    updateBytes = update.length
  })
  ydoc.transact(() => text.insert(text.length, marker))
  return updateBytes
}

const hasMarker = (ydoc: Y.Doc, marker: string) =>
  probeText(ydoc)?.toString().includes(marker) ?? false

type Writer = Awaited<ReturnType<typeof openWriter>>

/**
 * Opens one writer per instance, then adds the paragraph every marker goes into.
 * No worker drains the probe DB, so it lives only while both rooms stay loaded.
 */
const openPair = async () => {
  const writerA = await openWriter(instances[0])
  const writerB = await openWriter(instances[1])
  writerA.ydoc.transact(() => {
    const paragraph = new Y.XmlElement('paragraph')
    paragraph.insert(0, [new Y.XmlText(PROBE_TEXT)])
    writerA.ydoc.getXmlFragment('default').push([paragraph])
  })
  if (!(await waitFor(() => probeText(writerB.ydoc) !== null, 15_000))) {
    throw new Error('the probe paragraph never reached the writer on B')
  }
  await sleep(1000)
  return [writerA, writerB] as [Writer, Writer]
}

/** Types `edits` markers `burstMs` apart, like a person typing, then counts every frame. */
const runBurst = async () => {
  const [writerA, writerB] = await openPair()
  const from = frames.length
  let updateBytes = 0
  for (let i = 0; i < edits; i++) {
    updateBytes += insertMarker(writerA.ydoc, `.${i}`)
    await sleep(burstMs)
  }
  const delivered = await waitFor(() => hasMarker(writerB.ydoc, `.${edits - 1}`), 5000)
  await sleep(1000)
  const window = frames.slice(from).filter((f) => !f.kind.includes('Awareness'))
  writerA.provider.destroy()
  writerB.provider.destroy()
  return {
    edits,
    burstMs,
    lastDelivered: delivered,
    publishes: window.length,
    publishesPerEdit: Math.round((window.length / edits) * 100) / 100,
    bytesPerEdit: Math.round(window.reduce((sum, f) => sum + f.bytes, 0) / edits),
    updateBytesPerEdit: Math.round((updateBytes / edits) * 100) / 100
  }
}

const runPublishes = async () => {
  if (burstMs > 0) return runBurst()
  const [writerA, writerB] = await openPair()
  const results: { updateBytes: number; publishes: number; bytes: number; delivered: boolean }[] =
    []
  const byKind: Record<string, { n: number; bytes: number }> = {}
  for (let i = 0; i < edits; i++) {
    const marker = `.${i}`
    const from = frames.length
    const updateBytes = insertMarker(writerA.ydoc, marker)
    const delivered = await waitFor(() => hasMarker(writerB.ydoc, marker), 5000)
    await sleep(1000)
    const window = frames.slice(from).filter((f) => !f.kind.includes('Awareness'))
    for (const frame of window) {
      const key = `${frame.source} ${frame.kind}`
      byKind[key] ??= { n: 0, bytes: 0 }
      byKind[key].n += 1
      byKind[key].bytes += frame.bytes
    }
    const bytes = window.reduce((sum, f) => sum + f.bytes, 0)
    results.push({ updateBytes, publishes: window.length, bytes, delivered })
  }
  writerA.provider.destroy()
  writerB.provider.destroy()
  const mean = (pick: (r: (typeof results)[number]) => number) =>
    Math.round((results.reduce((sum, r) => sum + pick(r), 0) / results.length) * 100) / 100
  return {
    edits: results.length,
    delivered: results.filter((r) => r.delivered).length,
    publishesPerEdit: mean((r) => r.publishes),
    bytesPerEdit: mean((r) => r.bytes),
    updateBytesPerEdit: mean((r) => r.updateBytes),
    publishesRange: [
      Math.min(...results.map((r) => r.publishes)),
      Math.max(...results.map((r) => r.publishes))
    ],
    byKind
  }
}

// Each round SIGKILLs B a set delay after its writer's edit, so the edit can reach A
// only through the Redis handshake. The B writer's Y.Doc is discarded, so it cannot
// resend the edit on reconnect, and the restarted B loads the seed (no worker drains
// this Redis DB). A delivered marker on A's writer is the handshake that finished.
const runConvergence = async () => {
  const b = instances[1]
  const pair = await openPair()
  const writerA = pair[0]
  let writerB = pair[1]
  const outcomes: { round: number; delayMs: number; delivered: boolean }[] = []
  for (let round = 0; round < rounds; round++) {
    const delayMs = round * stepMs
    const marker = `.k${round}`
    insertMarker(writerB.ydoc, marker)
    await sleep(delayMs)
    b.proc?.kill('SIGKILL')
    writerB.provider.destroy()
    await b.proc?.exited
    await start(b)
    writerB = await openWriter(b)
    const expected = probeText(writerA.ydoc)?.toString() ?? ''
    if (!(await waitFor(() => probeText(writerB.ydoc)?.toString() === expected, 15_000))) {
      throw new Error(`round ${round}: restarted B never caught up with A`)
    }
    await sleep(500)
    const delivered = hasMarker(writerA.ydoc, marker)
    outcomes.push({ round, delayMs, delivered })
    console.log(`  round ${round} delay ${delayMs} ms: ${delivered ? 'delivered' : 'lost'}`)
  }
  writerA.provider.destroy()
  writerB.provider.destroy()
  return {
    rounds: outcomes.length,
    delivered: outcomes.filter((o) => o.delivered).length,
    lost: outcomes.filter((o) => !o.delivered).length,
    lostDelaysMs: outcomes.filter((o) => !o.delivered).map((o) => o.delayMs)
  }
}

const metricValue = async (instance: Instance, series: string) => {
  const text = await (await fetch(instance.metricsUrl)).text()
  const line = text.split('\n').find((l) => l.startsWith(`${series} `))
  return line ? Number(line.slice(series.length + 1)) : null
}
const RECONNECTS = 'ws_redis_subscriber_reconnects_total'
const RELAY_DROPS = 'stateless_relay_dropped_total{reason="broadcast-frame"}'
const metricPair = async (series: string) => ({
  A: await metricValue(instances[0], series),
  B: await metricValue(instances[1], series)
})

type Payload = { msg?: string; type?: string; version?: number; state?: boolean }

/**
 * Publishes `doc:<id>:saved` and `doc:<id>:access` straight to Redis, as the store worker
 * and REST do, and counts the stateless frames each client gets. The drop check cuts
 * A's save subscriber at the proxy for `gapMs`, so its reconnect backs off like a real outage.
 */
const runSaved = async () => {
  const pair = await openPair()
  const inbox: Payload[][] = pair.map((writer) => {
    const received: Payload[] = []
    writer.provider.on('stateless', ({ payload }: { payload: string }) => {
      received.push(JSON.parse(payload))
    })
    return received
  })
  const roomFrom = frames.length
  const relayBefore = await metricPair(RELAY_DROPS)
  let version = 1000

  const publishAndCount = async (
    channelName: string,
    body: Record<string, unknown>,
    match: (p: Payload) => boolean
  ) => {
    const from = inbox.map((received) => received.length)
    await admin.publish(channelName, JSON.stringify({ documentId, ...body }))
    await sleep(500)
    const [a, b] = inbox.map((received, i) => received.slice(from[i]).filter(match).length)
    return { A: a, B: b }
  }
  const save = () => {
    const v = ++version
    return publishAndCount(
      `doc:${documentId}:saved`,
      { version: v, timestamp: Date.now() },
      (p) => p.msg === 'document:saved' && p.version === v
    )
  }
  const access = (readOnly: boolean) =>
    publishAndCount(
      `doc:${documentId}:access`,
      { readOnly, ownerId: null, timestamp: new Date().toISOString() },
      (p) => p.type === 'readOnly' && p.state === readOnly
    )
  const summary = (counts: { A: number; B: number }[]) => {
    const all = counts.flatMap((c) => [c.A, c.B])
    return {
      n: counts.length,
      perClient: { A: counts.map((c) => c.A), B: counts.map((c) => c.B) },
      range: [Math.min(...all), Math.max(...all)]
    }
  }

  const savedCounts = []
  for (let i = 0; i < saves; i++) savedCounts.push(await save())
  const accessCounts = [await access(true), await access(false)]
  const roomChannelStateless = frames.slice(roomFrom).filter((f) => f.kind === 'Broadcast').length

  let drop = null
  if (gapMs > 0) {
    const reconnectsBefore = await metricPair(RECONNECTS)
    redisProxy.refusing = true
    const cut = redisProxy.subscribers.size
    for (const socket of redisProxy.subscribers) socket.destroy()
    const gapStart = Date.now()
    const during = []
    for (let k = 1; k <= gapSaves; k++) {
      await sleep(gapStart + (k * gapMs) / (gapSaves + 1) - Date.now())
      during.push(await save())
    }
    await sleep(gapStart + gapMs - Date.now())
    const back = new Promise<void>((resolve) => (redisProxy.onSubscriber = resolve))
    const restoredAt = Date.now()
    redisProxy.refusing = false
    await Promise.race([back, sleep(30_000)])
    const resubscribedMs = redisProxy.subscribers.size > 0 ? Date.now() - restoredAt : null
    await sleep(500)
    const after = []
    for (let k = 0; k < gapSaves; k++) after.push(await save())
    drop = {
      gapMs,
      subscriberSocketsCut: cut,
      resubscribedMs,
      during: summary(during),
      after: summary(after),
      reconnects: { before: reconnectsBefore, after: await metricPair(RECONNECTS) }
    }
  }

  const relayAfter = await metricPair(RELAY_DROPS)
  pair.forEach((writer) => writer.provider.destroy())
  return {
    saved: summary(savedCounts),
    access: summary(accessCounts),
    // Each replica's broadcastStateless publishes here; each peer sends it again.
    roomChannelBroadcasts: roomChannelStateless,
    relayDropsBroadcastFrame: { before: relayBefore, after: relayAfter },
    drop
  }
}

// --- Rows mode (#703): typers on k of R replicas, one worker, version rows per minute.
type Series = Map<string, number>
const scrapeSeries = async (url: string): Promise<Series> => {
  const series: Series = new Map()
  for (const line of (await (await fetch(url)).text()).split('\n')) {
    if (!line || line.startsWith('#')) continue
    const at = line.lastIndexOf(' ')
    series.set(line.slice(0, at), Number(line.slice(at + 1)))
  }
  return series
}
/** Null when no series matches, so a counter the build lacks never reads as 0. */
const sumSeries = (series: Series, name: string, labels: Record<string, string> = {}) => {
  let total: number | null = null
  for (const [key, value] of series) {
    if (key !== name && !key.startsWith(`${name}{`)) continue
    if (!Object.entries(labels).every(([k, v]) => key.includes(`${k}="${v}"`))) continue
    total = (total ?? 0) + value
  }
  return total
}
const delta = (after: number | null, before: number | null) =>
  after === null || before === null ? null : Math.round((after - before) * 1000) / 1000
const STORE_OUTCOMES = ['inserted', 'unchanged', 'coalesced', 'head-moved']
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
}

const runRows = async () => {
  const worker = await spawnWorker(
    'worker',
    { databaseUrl: pgProxy.url, redisDb, logFile: join(scratch, 'worker.log') },
    workerConcurrency
  )
  process.once('exit', () => worker.proc.kill('SIGKILL'))
  // The extension's redlock: each acquire runs one script with a fresh value, and a
  // won acquire runs one `set` inside it. Attempts less wins are the lock skips.
  const lockKey = `hocuspocus:${documentId}:lock`
  const lockAttempts = new Set<string>()
  const lockWins = new Set<string>()
  const monitor = countLocks ? await admin.monitor() : null
  monitor?.on('monitor', (_time: string, cmd: string[]) => {
    const name = cmd[0]?.toLowerCase()
    if ((name === 'evalsha' || name === 'eval') && cmd.length === 7 && cmd[3] === lockKey) {
      lockAttempts.add(cmd[5])
    } else if (name === 'set' && cmd[1] === lockKey) lockWins.add(cmd[2])
  })

  const writers: Writer[] = []
  for (const instance of instances) writers.push(await openWriter(instance))
  writers[0].ydoc.transact(() => {
    const paragraph = new Y.XmlElement('paragraph')
    paragraph.insert(0, [new Y.XmlText(PROBE_TEXT)])
    writers[0].ydoc.getXmlFragment('default').push([paragraph])
  })
  const readers: Writer[] = []
  for (let i = instanceCount; i < socketCount; i++) {
    const reader = await makeOpenProvider(instances[i % instanceCount].port)(
      documentId,
      documentId,
      ''
    )
    if (!reader.synced) throw new Error(`reader ${i} never synced`)
    readers.push(reader)
  }
  const everyone = writers.concat(readers)
  if (!(await waitFor(() => everyone.every((w) => probeText(w.ydoc) !== null), 15_000))) {
    throw new Error('the probe paragraph never reached every socket')
  }

  const queueEmpty = async () =>
    (await admin.llen('bull:store-documents:wait')) +
      (await admin.llen('bull:store-documents:active')) ===
    0
  // The setup edit saves after the 10 s debounce; let it land before the window opens.
  const drain = async () => {
    await sleep(12_000)
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline && !(await queueEmpty())) await sleep(250)
    await sleep(1000)
  }
  await drain()

  const snapshot = async () => ({
    at: Date.now(),
    rows: await prisma.documents.count({ where: { documentId } }),
    worker: await scrapeSeries(worker.metricsUrl),
    ws: await Promise.all(instances.map((i) => scrapeSeries(i.metricsUrl))),
    lockAttempts: lockAttempts.size,
    lockWins: lockWins.size
  })
  type Sample = {
    cpu: number | null
    lagMax: number | null
    lagP99: number | null
    rss: number | null
  }
  const samples: Sample[][] = instances.map(() => [])
  const sampleWs = async () => {
    const all = await Promise.all(instances.map((i) => scrapeSeries(i.metricsUrl)))
    all.forEach((series, i) =>
      samples[i].push({
        cpu: sumSeries(series, 'process_cpu_seconds_total'),
        lagMax: sumSeries(series, 'nodejs_eventloop_lag_max_seconds'),
        lagP99: sumSeries(series, 'nodejs_eventloop_lag_p99_seconds'),
        rss: sumSeries(series, 'process_resident_memory_bytes')
      })
    )
  }

  // Typers that start together share one 60 s save clock, so the redlock skips all but
  // one save. Typer j starts j x staggerMs in, and the window opens once all type.
  type Snapshot = Awaited<ReturnType<typeof snapshot>>
  const intervalMs = 1000 / cps
  const warmTicks = Math.round(((typerCount - 1) * staggerMs * cps) / 1000)
  const ticks = warmTicks + Math.round(minutes * 60 * cps)
  const typingFrom = Date.now()
  let opened: Snapshot | null = null
  let nextSample = 0
  for (let tick = 0; tick < ticks; tick++) {
    if (tick === warmTicks) {
      opened = await snapshot()
      await sampleWs()
      nextSample = opened.at + 5000
    }
    writers.slice(0, typerCount).forEach((writer, j) => {
      if (tick * intervalMs >= j * staggerMs) insertMarker(writer.ydoc, 'abcdefgh '[tick % 9])
    })
    if (opened && Date.now() >= nextSample) {
      nextSample += 5000
      await sampleWs()
    }
    await sleep(typingFrom + (tick + 1) * intervalMs - Date.now())
  }
  if (!opened) throw new Error('the window never opened')
  await sampleWs()
  const end = await snapshot()
  await drain()
  const tail = await snapshot()

  const events = await admin.xrange('bull:store-documents:events', String(opened.at), '+')
  const eventCount = (kind: string, from: number, to: number) =>
    events.filter(([id, fields]) => {
      const at = Number(id.split('-')[0])
      return at >= from && at < to && fields[0] === 'event' && fields[1] === kind
    }).length
  const queueEvents = (from: Snapshot, to: Snapshot) => ({
    jobsAdded: eventCount('added', from.at, to.at),
    jobIdDedupes: eventCount('duplicated', from.at, to.at),
    lockAttempts: countLocks ? to.lockAttempts - from.lockAttempts : null,
    lockSkips: countLocks
      ? to.lockAttempts - from.lockAttempts - (to.lockWins - from.lockWins)
      : null
  })
  const outcomes = (from: Snapshot, to: Snapshot) =>
    Object.fromEntries(
      STORE_OUTCOMES.map((outcome) => [
        outcome,
        delta(
          sumSeries(to.worker, 'document_store_outcome_total', { outcome }),
          sumSeries(from.worker, 'document_store_outcome_total', { outcome })
        )
      ])
    )
  const completed = (s: Snapshot) =>
    sumSeries(s.worker, 'jobs_total', { queue: 'store-documents', status: 'completed' })
  const windowMinutes = (end.at - opened.at) / 60_000

  const ws = instances.map((instance, i) => {
    const cpuSeconds = delta(samples[i].at(-1)?.cpu ?? null, samples[i][0]?.cpu ?? null)
    const lagMax = samples[i].map((s) => s.lagMax).filter((v): v is number => v !== null)
    const lagP99 = samples[i].map((s) => s.lagP99).filter((v): v is number => v !== null)
    const rss = samples[i].map((s) => s.rss).filter((v): v is number => v !== null)
    return {
      label: instance.label,
      typer: i < typerCount,
      sockets: 1 + readers.filter((_, r) => (instanceCount + r) % instanceCount === i).length,
      cpuPercent:
        cpuSeconds === null ? null : Math.round((cpuSeconds / (windowMinutes * 60)) * 1000) / 10,
      lagMaxSeconds: lagMax.length ? Math.max(...lagMax) : null,
      lagP99Seconds: { median: median(lagP99), max: lagP99.length ? Math.max(...lagP99) : null },
      rssMaxBytes: rss.length ? Math.max(...rss) : null,
      fallbackInserted: delta(
        sumSeries(tail.ws[i], 'document_store_outcome_total', { outcome: 'inserted' }),
        sumSeries(opened.ws[i], 'document_store_outcome_total', { outcome: 'inserted' })
      )
    }
  })
  const hot = ws.reduce((a, b) => ((b.cpuPercent ?? -1) > (a.cpuPercent ?? -1) ? b : a))

  monitor?.disconnect()
  everyone.forEach((w) => w.provider.destroy())
  worker.proc.kill('SIGKILL')
  await worker.proc.exited
  return {
    instances: instanceCount,
    typers: typerCount,
    sockets: socketCount,
    cps,
    windowMinutes: Math.round(windowMinutes * 1000) / 1000,
    windowKeystrokesPerTyper: ticks - warmTicks,
    staggerMs,
    rows: {
      window: end.rows - opened.rows,
      perMinute: Math.round(((end.rows - opened.rows) / windowMinutes) * 1000) / 1000,
      tail: tail.rows - end.rows
    },
    jobsCompleted: {
      window: delta(completed(end), completed(opened)),
      tail: delta(completed(tail), completed(end))
    },
    storeOutcomes: { window: outcomes(opened, end), tail: outcomes(end, tail) },
    queue: { window: queueEvents(opened, end), tail: queueEvents(end, tail) },
    hotReplica: hot.label,
    ws
  }
}

let exitCode = 0
try {
  await prisma.documentMetadata.create({ data: { documentId, slug: documentId } })
  await prisma.documents.create({ data: { documentId, version: 1, data: Buffer.from(fixture) } })
  await Promise.all(instances.map(start))

  const result =
    mode === 'publishes'
      ? await runPublishes()
      : mode === 'saved'
        ? await runSaved()
        : mode === 'rows'
          ? await runRows()
          : await runConvergence()
  console.log(
    JSON.stringify(
      {
        mode,
        fixture: fixtureLabel,
        fixtureBytes: fixture.length,
        redisDb,
        identifiers: Object.fromEntries(identifiers),
        result
      },
      null,
      2
    )
  )
} catch (error) {
  console.error(error)
  exitCode = 1
} finally {
  stopAll()
  await Promise.all(instances.map((i) => i.proc?.exited))
  await prisma.documentMetadata.deleteMany({ where: { documentId } })
  const created = (await admin.keys('*')).filter((key) => !keysBefore.has(key))
  if (created.length > 0) await admin.del(...created)
  subscriber.disconnect()
  admin.disconnect()
  pgProxy.close()
  if (mode === 'saved') redisProxyServer.close()
  // The replicas log here unless --log-dir, so a failed run keeps the logs.
  if (exitCode === 0) rmSync(scratch, { recursive: true, force: true })
  else console.error(`replica logs kept in ${logDir || scratch}`)
  await prisma.$disconnect()
}
process.exit(exitCode)
