/**
 * Measures cross-replica sync for #595: two production-mode WS processes on one
 * Redis, one writer on each, one document. A measurement tool, not a test.
 * Run from apps/hocuspocus.server:
 *   bun --env-file=../../.env.local scripts/redis-sync-probe.ts --mode publishes
 *   bun --env-file=../../.env.local scripts/redis-sync-probe.ts --mode convergence
 * Options: --fixture <Y update file>, --edits 20, --rounds 30, --step-ms 10, --burst-ms 0, --redis-db 7.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import tls from 'node:tls'

import { spawnSync, type Subprocess } from 'bun'
import Redis from 'ioredis'
import * as Y from 'yjs'

import { freePort, makeOpenProvider, sleep, waitForHttp } from './lib/e2eHarness'

// Before the dynamic import: `production` turns on TLS in this process's pool.
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'warn'
const { prisma } = await import('../src/lib/prisma')

const PACKAGE_ROOT = new URL('..', import.meta.url).pathname
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
if (mode !== 'publishes' && mode !== 'convergence') throw new Error(`unknown --mode ${mode}`)
const edits = Number(option('--edits', '20'))
const rounds = Number(option('--rounds', '30'))
const redisDb = Number(option('--redis-db', '7'))
const stepMs = Number(option('--step-ms', '10'))
// Publishes mode: 0 waits for each edit to land; above 0 types the edits that many ms apart.
const burstMs = Number(option('--burst-ms', '0'))
const fixturePath = option('--fixture', DEFAULT_FIXTURE)

/** Typing and backspacing, so the fixture carries a real delete set. */
const buildEditedFixture = (targetBytes: number): Uint8Array => {
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
    for (let i = 0; i < 2000; i++) {
      if (rand() < 0.3 && text.length > 0) doc.transact(() => text.delete(text.length - 1, 1))
      else doc.transact(() => text.insert(text.length, 'abcdefgh '[i % 9]))
    }
  }
  return Y.encodeStateAsUpdate(doc)
}

const fixture = existsSync(fixturePath)
  ? new Uint8Array(readFileSync(fixturePath))
  : buildEditedFixture(1_000_000)
const fixtureLabel = existsSync(fixturePath) ? fixturePath : 'built: type and delete'

// --- Postgres TLS terminator. Production mode forces TLS; local Postgres has none.
const scratch = mkdtempSync(join(tmpdir(), 'redis-sync-probe-'))
const certFiles = { key: join(scratch, 'key.pem'), cert: join(scratch, 'cert.pem') }
const openssl = spawnSync(
  [
    'openssl',
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-keyout',
    certFiles.key,
    '-out',
    certFiles.cert
  ],
  { stderr: 'ignore' }
)
if (openssl.exitCode !== 0) throw new Error('openssl could not mint the proxy certificate')
const secureContext = tls.createSecureContext({
  key: readFileSync(certFiles.key),
  cert: readFileSync(certFiles.cert)
})

const databaseUrl = new URL(process.env.DATABASE_URL ?? '')
const pgHost = databaseUrl.hostname
const pgPort = Number(databaseUrl.port || 5432)
const SSL_REQUEST = 80877103

// Answers the SSLRequest with 'S', ends TLS here, and pipes plain bytes to Postgres.
const pgProxy = net.createServer((raw) => {
  raw.once('data', (first: Buffer) => {
    const upstream = net.connect(pgPort, pgHost)
    upstream.on('error', () => raw.destroy())
    if (first.length === 8 && first.readUInt32BE(4) === SSL_REQUEST) {
      raw.write('S')
      const secure = new tls.TLSSocket(raw, { isServer: true, secureContext })
      secure.on('error', () => upstream.destroy())
      secure.pipe(upstream)
      upstream.pipe(secure)
    } else {
      upstream.write(first)
      raw.pipe(upstream)
      upstream.pipe(raw)
    }
  })
  raw.on('error', () => undefined)
})
const pgProxyPort = freePort()
await new Promise<void>((resolve) => pgProxy.listen(pgProxyPort, '127.0.0.1', resolve))
const proxiedUrl = new URL(databaseUrl)
proxiedUrl.hostname = '127.0.0.1'
proxiedUrl.port = String(pgProxyPort)

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
const TYPES = ['Sync', 'Awareness', 'Auth', 'QueryAwareness', 'SyncReply', 'Stateless']
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

// --- Two production-mode WS processes.
interface Instance {
  label: string
  port: number
  internalPort: number
  proc: Subprocess | null
}
const instances: Instance[] = ['A', 'B'].map((label) => ({
  label,
  port: freePort(),
  internalPort: freePort(),
  proc: null
}))

const start = async (instance: Instance) => {
  instance.proc = Bun.spawn(['bun', 'src/hocuspocus.server.ts'], {
    cwd: PACKAGE_ROOT,
    stdout: 'ignore',
    stderr: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      REDIS: 'true',
      REDIS_DB: String(redisDb),
      DATABASE_URL: proxiedUrl.toString(),
      HOCUSPOCUS_PORT: String(instance.port),
      HOCUSPOCUS_INTERNAL_HTTP_PORT: String(instance.internalPort),
      HOCUSPOCUS_INTERNAL_HTTP_HOST: '127.0.0.1',
      HOCUSPOCUS_INTERNAL_URL: `http://127.0.0.1:${instance.internalPort}`,
      HOCUSPOCUS_LOGGER: 'false',
      HOCUSPOCUS_THROTTLE: 'false',
      LOG_LEVEL: 'error',
      WS_LOG_LEVEL: 'error',
      // Production mode must never report to a remote from a local probe.
      GLITCHTIP_DSN: ''
    }
  })
  const healthUrl = `http://127.0.0.1:${instance.port}/health/redis`
  if (!(await waitForHttp(healthUrl, 60_000))) throw new Error(`${instance.label} never came up`)
  const health = (await (await fetch(healthUrl)).json()) as { status?: string }
  if (health.status !== 'configured') {
    throw new Error(`${instance.label}: RedisExtension did not load (${JSON.stringify(health)})`)
  }
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

let exitCode = 0
try {
  await prisma.documentMetadata.create({ data: { documentId, slug: documentId } })
  await prisma.documents.create({ data: { documentId, version: 1, data: Buffer.from(fixture) } })
  await Promise.all(instances.map(start))

  const result = mode === 'publishes' ? await runPublishes() : await runConvergence()
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
  rmSync(scratch, { recursive: true, force: true })
  await prisma.$disconnect()
}
process.exit(exitCode)
