/**
 * Link-scraper tolerance bench runner: one scenario session end to end. Not product code.
 * Usage (from apps/hocuspocus.server):
 *   bun scripts/bench-link-tolerance/run.ts <scenario> [--smoke] [--dry-run] [--layer=2]
 *     [--variant=module|baseline|coalesce] [--rates=a,b] [--concurrency=1,4] [--step=S]
 *     [--warmup=S] [--ip=pool|none|many] [--order=reverse] [--redis=docker|native]
 *     [--conn=pooled|fresh] [--out=<dir>] [--rate-limit-max=N] [--keep-redis] [--force-long]
 * Appends JSON lines to <out>/<scenario>.jsonl: one session header, one line per step, one footer.
 */
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  closeSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync
} from 'node:fs'
import { cpus, loadavg, platform, release, totalmem } from 'node:os'
import { join, relative } from 'node:path'

import {
  KNEE_RULE,
  OTHER_CPU_LIMIT_PCT,
  pairSummary,
  seriesKnees,
  VOID_RULES_VERSION,
  voidReasonsOf
} from './analysis'
import type { DriverConfig, Lane } from './driver'

const BENCH_DIR = import.meta.dir
const SERVER_DIR = join(BENCH_DIR, '../..')
const ROOT = join(SERVER_DIR, '../..')
const RAW_DIR = join(ROOT, 'Notes/local-docs/2026-11-13-link-scraper-tolerance/raw')
const CORPUS_DIR = join(ROOT, 'Notes/local-docs/2026-10-26-242-hovercard/bench/corpus/pages')
const LOCK_PATH = join(RAW_DIR, '.bench.lock')
const PORTS = { rest: 4620, origin: 4621, side: 4622, redis: 6391 }
const REDIS_CONTAINER = 'linkbench-redis'
const REST = `http://127.0.0.1:${PORTS.rest}`
const ORIGIN = `http://127.0.0.1:${PORTS.origin}`
const SIDE = `http://127.0.0.1:${PORTS.side}`
const DRIVER_TIMEOUT_MS = 15_000
const PAD_HOST = '203.0.113.251'
const HOSTILE_VECTORS = [
  'itemprop-flood',
  'deep-nesting',
  'no-head-end',
  'entity-run',
  'jsonld-quotes',
  'many-meta'
]
// Outbound only to the fake origin, the bench Redis and REST's own side port (the foreign-peer
// control), and no mDNSResponder. Shared services on other loopback ports are refused too.
const FENCE_PROFILE =
  '(version 1)(allow default)(deny network-outbound)' +
  '(allow network-outbound (remote ip "localhost:4621"))' +
  '(allow network-outbound (remote ip "localhost:6391"))' +
  '(allow network-outbound (remote ip "localhost:4622"))' +
  '(deny network-outbound (remote unix-socket (path-literal "/private/var/run/mDNSResponder")))'

// ---------- arguments ----------

const argv = process.argv.slice(2)
const scenario = argv.find((a) => !a.startsWith('--')) ?? ''
const flag = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const has = (name: string) => argv.includes(`--${name}`)
const smoke = has('smoke')
const dryRun = has('dry-run')
const layer = Number(flag('layer') ?? 1)
const variant = flag('variant') ?? 'baseline'
const outDir = flag('out') ?? join(RAW_DIR, smoke ? 'smoke' : '')
const stepOverride = flag('step') ? Number(flag('step')) : undefined
const warmupOverride = flag('warmup') ? Number(flag('warmup')) : undefined
const ratesOverride = flag('rates')?.split(',').map(Number)
const concurrencyRamp = flag('concurrency')?.split(',').map(Number)
const ipOverride = flag('ip') as DriverConfig['ip'] | undefined
const order = flag('order') === 'reverse' ? 'reverse' : 'forward'
const redisBackend = flag('redis') === 'native' ? 'native' : 'docker'
// `fresh`: REST opens a new connection per fetch (B4 arm). Every miss number names its transport.
const conn = flag('conn') === 'fresh' ? 'fresh' : 'pooled'
const TRANSPORT = `${conn} loopback, no DNS, no TLS`
const SESSION_BUDGET_S = 450
// State carries over between these steps, or the session is already a paired design.
const NO_CONTROL = new Set(['herd', 'redis-stall', 'limiter', 'aa', 'step0', 'lag-probe'])
const CONTROL_REST_S = smoke ? 3 : 10
const MIN_N = 2000

// ---------- small helpers ----------

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const quantile = (sorted: number[], q: number) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
const sleep = (ms: number) => Bun.sleep(ms)
const now = () => performance.now()

/** Async child with a deadline: a wedged Docker daemon or lsof can never wedge the runner. */
const run = async (cmd: string[], ms = 15_000, cwd = ROOT) => {
  try {
    const p = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      p.kill('SIGKILL')
    }, ms)
    const [out, err, code] = await Promise.all([
      new Response(p.stdout).text(),
      new Response(p.stderr).text(),
      p.exited
    ])
    clearTimeout(timer)
    return { ok: code === 0 && !timedOut, code, out: out.trim(), err: err.trim(), timedOut }
  } catch (error) {
    return { ok: false, code: -1, out: '', err: String(error), timedOut: false }
  }
}
const docker = (args: string[], ms = 15_000) => run(['docker', ...args], ms)

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const treeHash = (paths: string[]): string => {
  const files: string[] = []
  const walk = (p: string) => {
    if (!existsSync(p)) {
      files.push(`missing:${p}`)
      return
    }
    if (statSync(p).isDirectory()) for (const name of readdirSync(p).sort()) walk(join(p, name))
    else files.push(p)
  }
  for (const p of paths) walk(p)
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(ROOT, file)).update('\0')
    if (!file.startsWith('missing:')) hash.update(readFileSync(file))
  }
  return hash.digest('hex').slice(0, 16)
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, sleep(ms).then(() => null)])

const getJson = async (url: string, ms = 1000): Promise<any | null> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) })
    return await res.json()
  } catch {
    return null
  }
}

/** One RESP command on a fresh socket, so a paused Redis can never wedge the sampler. */
const redisCmd = (args: string[], ms = 500): Promise<string | null> =>
  new Promise((resolve) => {
    let buf = Buffer.alloc(0)
    let done = false
    const finish = (value: string | null, socket?: { end(): void }) => {
      if (done) return
      done = true
      socket?.end()
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), ms)
    Bun.connect({
      hostname: '127.0.0.1',
      port: PORTS.redis,
      socket: {
        open(socket) {
          socket.write(
            `*${args.length}\r\n${args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}\r\n`).join('')}`
          )
        },
        data(socket, chunk) {
          buf = Buffer.concat([buf, chunk])
          const text = buf.toString('utf8')
          if (text[0] === '+' || text[0] === '-' || text[0] === ':') {
            if (text.includes('\r\n')) {
              clearTimeout(timer)
              finish(text.slice(1, text.indexOf('\r\n')), socket)
            }
          } else if (text[0] === '$') {
            const nl = text.indexOf('\r\n')
            const len = Number(text.slice(1, nl))
            if (buf.length >= nl + 2 + len) {
              clearTimeout(timer)
              finish(buf.subarray(nl + 2, nl + 2 + len).toString('utf8'), socket)
            }
          }
        },
        error() {
          finish(null)
        },
        close() {
          finish(null)
        }
      }
    }).catch(() => finish(null))
  })

const redisInfo = async () => {
  const text = await redisCmd(['INFO'])
  if (!text) return null
  const field = (name: string) => Number(text.match(new RegExp(`^${name}:(\\S+)`, 'm'))?.[1] ?? NaN)
  return {
    connectedClients: field('connected_clients'),
    opsPerSec: field('instantaneous_ops_per_sec'),
    usedMemory: field('used_memory'),
    commands: field('total_commands_processed'),
    connectionsReceived: field('total_connections_received'),
    processId: field('process_id'),
    version: text.match(/^redis_version:(\S+)/m)?.[1] ?? 'unknown'
  }
}

const commandCalls = async (): Promise<Record<string, number> | null> => {
  const text = await redisCmd(['INFO', 'commandstats'], 1000)
  if (!text) return null
  const out: Record<string, number> = {}
  for (const m of text.matchAll(/^cmdstat_([^:]+):calls=(\d+)/gm)) out[m[1]] = Number(m[2])
  return out
}

const waitFor = async (url: string, ms: number) => {
  const until = Date.now() + ms
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(500) })
      if (res.ok) return true
    } catch {
      /* not up yet */
    }
    await sleep(150)
  }
  return false
}

const portBusy = async (port: number) =>
  (await withTimeout(
    Bun.connect({
      hostname: '127.0.0.1',
      port,
      socket: {
        data() {},
        open(s) {
          s.end()
        }
      }
    })
      .then(() => true)
      .catch(() => false),
    500
  )) === true

// ---------- ownership: lock, children, Redis ----------

const session = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
type Proc = ReturnType<typeof Bun.spawn>
const procs: Proc[] = []
const own = {
  lock: false,
  redis: false,
  /** The owner label of the container this run started or adopted; rm only while it matches. */
  redisLabel: '',
  redisPid: 0,
  redisProc: null as Proc | null,
  paused: false,
  headerWritten: false,
  footerWritten: false
}
let jsonlPath = ''

const writeLock = () =>
  writeFileSync(
    LOCK_PATH,
    JSON.stringify({
      pid: process.pid,
      session,
      scenario,
      startedAt: new Date().toISOString(),
      children: procs.map((p) => p.pid),
      redisPid: own.redisPid || null,
      redisBackend
    })
  )

/** One runner at a time. A lock whose pid is dead is stale: its leftovers go first. */
const acquireLock = async (): Promise<string | null> => {
  mkdirSync(RAW_DIR, { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    // Write a full temp file, then link it into place: link is atomic and fails on EEXIST, so
    // no reader ever sees an empty lock.
    const tmp = `${LOCK_PATH}.${process.pid}`
    try {
      const fd = openSync(tmp, 'w')
      writeSync(fd, JSON.stringify({ pid: process.pid, session }))
      closeSync(fd)
      linkSync(tmp, LOCK_PATH)
      unlinkSync(tmp)
      own.lock = true
      writeLock()
      return null
    } catch (err: any) {
      try {
        unlinkSync(tmp)
      } catch {
        /* gone */
      }
      if (err?.code !== 'EEXIST') return `lock ${LOCK_PATH}: ${err?.message}`
    }
    let info: any = {}
    try {
      info = JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
    } catch {
      return `lock ${LOCK_PATH} is unreadable; remove it by hand after checking no bench runs`
    }
    if (info.pid && alive(info.pid))
      return `another bench run holds the lock (pid ${info.pid}, session ${info.session}, ${info.scenario ?? '?'})`
    console.error(`stale lock from session ${info.session}: cleaning its leftovers`)
    for (const pid of [...(info.children ?? []), info.redisPid].filter(Boolean)) {
      const cmd = (await run(['ps', '-o', 'command=', '-p', String(pid)], 3000)).out
      if (/bench-link-tolerance|redis-server .*6391/.test(cmd)) process.kill(pid, 'SIGKILL')
    }
    if (info.redisBackend !== 'native' && info.session) {
      const label = await docker(
        ['inspect', '-f', '{{index .Config.Labels "linkbench.owner"}}', REDIS_CONTAINER],
        15_000
      )
      if (label.ok && label.out === info.session) await docker(['rm', '-f', REDIS_CONTAINER])
    }
    try {
      unlinkSync(LOCK_PATH)
    } catch {
      /* already gone */
    }
  }
  return 'could not take the lock'
}

const releaseLock = () => {
  if (!own.lock) return
  try {
    const info = JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
    if (info.pid === process.pid) unlinkSync(LOCK_PATH)
  } catch {
    /* gone */
  }
  own.lock = false
}

const spawnChild = (cmd: string[], opts: Parameters<typeof Bun.spawn>[1]) => {
  const p = Bun.spawn(cmd, opts)
  procs.push(p)
  if (own.lock) writeLock()
  return p
}

const startRedis = async (): Promise<{ version: string; digest: string; reused: boolean }> => {
  if (redisBackend === 'native') {
    if (await portBusy(PORTS.redis)) throw new Error(`port ${PORTS.redis} (redis) is busy`)
    const p = Bun.spawn(
      [
        'redis-server',
        '--port',
        String(PORTS.redis),
        '--bind',
        '127.0.0.1',
        '--save',
        '',
        '--appendonly',
        'no',
        '--protected-mode',
        'yes'
      ],
      {
        stdout: Bun.file(join(outDir, 'logs', `${scenario}-${session}.redis.log`)),
        // A pipe nobody reads fills and blocks Redis, which would read as a Redis stall.
        stderr: Bun.file(join(outDir, 'logs', `${scenario}-${session}.redis.stderr.log`))
      }
    )
    own.redis = true
    own.redisPid = p.pid
    own.redisProc = p
    writeLock()
  } else {
    const ping = await docker(['version', '--format', '{{.Server.Version}}'], 15_000)
    if (!ping.ok)
      throw new Error(
        `Docker daemon did not answer in 15 s (${ping.timedOut ? 'timeout' : ping.err})`
      )
    const state = await docker([
      'inspect',
      '-f',
      '{{index .Config.Labels "linkbench.owner"}} {{.State.Running}} {{.State.Paused}}',
      REDIS_CONTAINER
    ])
    let reused = false
    own.redisLabel = session
    if (!state.ok) {
      if (await portBusy(PORTS.redis)) throw new Error(`port ${PORTS.redis} (redis) is busy`)
      const started = await docker(
        [
          'run',
          '-d',
          '--pull=never',
          '--name',
          REDIS_CONTAINER,
          '--label',
          `linkbench.owner=${session}`,
          '-p',
          `127.0.0.1:${PORTS.redis}:6379`,
          'redis:alpine'
        ],
        30_000
      )
      if (!started.ok) throw new Error(`docker run failed: ${started.err}`)
    } else {
      // We hold the lock, so a bench owner is gone (crashed or --keep-redis). Adopt only a
      // container that carries a bench session label; anything else is not ours to touch.
      const [label, running, paused] = state.out.split(' ')
      if (!/^\d{8}T\d{6}$/.test(label ?? ''))
        throw new Error(
          `${REDIS_CONTAINER} exists without a bench owner label (${label}); refusing`
        )
      reused = true
      own.redisLabel = label
      if (paused === 'true') await docker(['unpause', REDIS_CONTAINER])
      else if (running === 'false') await docker(['start', REDIS_CONTAINER])
    }
    own.redis = true
    const port = await docker(['port', REDIS_CONTAINER, '6379/tcp'])
    if (!port.out.split('\n').includes(`127.0.0.1:${PORTS.redis}`))
      throw new Error(`${REDIS_CONTAINER} does not own 127.0.0.1:${PORTS.redis} (${port.out})`)
    writeLock()
    for (let i = 0; i < 40 && (await redisCmd(['PING'])) !== 'PONG'; i++) await sleep(250)
    const digest = (await docker(['image', 'inspect', 'redis:alpine', '--format', '{{.Id}}'])).out
    const info = await redisInfo()
    if (!info) throw new Error('bench Redis did not answer on 6391')
    return { version: info.version, digest, reused }
  }
  for (let i = 0; i < 40 && (await redisCmd(['PING'])) !== 'PONG'; i++) await sleep(250)
  const info = await redisInfo()
  // FLUSHALL goes only to a server proven to be our own child.
  if (!info || info.processId !== own.redisPid)
    throw new Error(
      `6391 answered from pid ${info?.processId}, not our redis-server ${own.redisPid}`
    )
  return {
    version: info.version,
    digest: `native ${(await run(['redis-server', '--version'])).out}`,
    reused: false
  }
}

const pauseRedis = async (pause: boolean) => {
  if (redisBackend === 'native') {
    if (own.redisPid) process.kill(own.redisPid, pause ? 'SIGSTOP' : 'SIGCONT')
  } else await docker([pause ? 'pause' : 'unpause', REDIS_CONTAINER])
  own.paused = pause
}

let cleaning: Promise<void> | null = null
/** Undoes only what this run created. A refused start owns nothing, so it removes nothing. */
const cleanup = (reason: string) =>
  (cleaning ??= (async () => {
    if (own.paused) await pauseRedis(false).catch(() => {})
    for (const p of [...procs].reverse()) {
      if (p.exitCode !== null || p.signalCode !== null) continue
      p.kill('SIGTERM')
      if ((await withTimeout(p.exited, 8000)) === null) p.kill('SIGKILL')
    }
    if (own.redis && !has('keep-redis')) {
      if (redisBackend === 'native' && own.redisProc) {
        own.redisProc.kill('SIGTERM')
        if ((await withTimeout(own.redisProc.exited, 5000)) === null) own.redisProc.kill('SIGKILL')
      } else if (redisBackend === 'docker') {
        const label = await docker([
          'inspect',
          '-f',
          '{{index .Config.Labels "linkbench.owner"}}',
          REDIS_CONTAINER
        ])
        if (label.ok && own.redisLabel && label.out === own.redisLabel)
          await docker(['rm', '-f', REDIS_CONTAINER])
      }
    }
    if (own.headerWritten && !own.footerWritten && jsonlPath) {
      appendFileSync(
        jsonlPath,
        `${JSON.stringify({ type: 'footer', session, valid: false, voidReasons: [`aborted: ${reason}`] })}\n`
      )
      own.footerWritten = true
    }
    canary.stop()
    releaseLock()
  })())

for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
  ['SIGHUP', 129]
] as const) {
  process.on(signal, () => {
    console.error(`${signal}: tearing down`)
    void cleanup(signal).then(() => process.exit(code))
  })
}

// ---------- samplers: one session-long set, sliced per window ----------

const parseCpuTime = (t: string): number => {
  const [dayPart, rest] = t.includes('-') ? t.split('-') : ['0', t]
  return (
    Number(dayPart) * 86400 +
    rest
      .split(':')
      .map(Number)
      .reduce((acc, v) => acc * 60 + v, 0)
  )
}

const LOOPBACK = new Set(['127.0.0.1', '[::1]', 'localhost'])

class Sampler {
  t0 = now()
  running = true
  ps: { t: number; pid: number; rssMiB: number; cpuS: number }[] = []
  lsof: {
    t: number
    established: number
    toOrigin: number
    redisPorts: string
    listen: string[]
  }[] = []
  foreign: { t: number; peer: string }[] = []
  timeWait: { t: number; n: number | null; err?: string }[] = []
  redis: { t: number; ok: boolean; ops?: number; clients?: number }[] = []
  side: {
    t: number
    inflight: number
    heapMiB: number
    rssMiB: number
    lagMax: number
    blocked: number
  }[] = []
  origin: { t: number; active: number; streaming: number }[] = []
  watched: number[] = []
  restPid = 0
  done: Promise<void>[] = []

  start(restPid: number, watched: () => number[]) {
    this.restPid = restPid
    this.done.push(
      (async () => {
        while (this.running) {
          const pids = [restPid, ...watched()].filter(Boolean)
          const res = await run(['ps', '-o', 'pid=,rss=,time=', '-p', pids.join(',')], 3000)
          const t = now()
          for (const line of res.out.split('\n')) {
            const [pid, rss, time] = line.trim().split(/\s+/)
            if (rss)
              this.ps.push({
                t,
                pid: Number(pid),
                rssMiB: Number(rss) / 1024,
                cpuS: parseCpuTime(time)
              })
          }
          await sleep(250)
        }
      })(),
      (async () => {
        while (this.running) {
          await this.slowTick()
          await sleep(1000)
        }
      })()
    )
  }

  async slowTick() {
    const [lsof, netstat, info, side, origin] = await Promise.all([
      run(['lsof', '-nP', '-w', '-a', '-p', String(this.restPid), '-i'], 5000),
      // Under GNU timeout netstat printed nothing with exit 0 (2026-11-14), which read as 0
      // TIME_WAIT. The origin's own LISTEN line must show, or the read is void.
      run(
        [
          'sh',
          '-c',
          `netstat -an -p tcp | awk '/127\\.0\\.0\\.1\\.${PORTS.origin} / { if (/LISTEN/) l++; if (/TIME_WAIT/) n++ } END {print l+0, n+0}'`
        ],
        5000
      ),
      redisInfo(),
      getJson(`${SIDE}/stats`, 500),
      getJson(`${ORIGIN}/__live`, 500)
    ])
    const t = now()
    let established = 0
    let toOrigin = 0
    const redisPorts: number[] = []
    const listen: string[] = []
    for (const line of lsof.out.split('\n')) {
      const l = line.match(/(TCP|UDP) (\S+?):(\d+|\*)(?:->(\S+?):(\d+))?(?: \((\w+)\))?/)
      if (!l) continue
      const [, proto, localHost, localPortS, remoteHost, remotePortS, state] = l
      const localPort = Number(localPortS)
      if (state === 'LISTEN') {
        listen.push(`${localHost}:${localPort}`)
        if (!LOOPBACK.has(localHost))
          this.foreign.push({ t, peer: `listen ${localHost}:${localPort}` })
        continue
      }
      if (!remoteHost) {
        if (proto === 'UDP') this.foreign.push({ t, peer: `udp ${localHost}:${localPortS}` })
        continue
      }
      const remotePort = Number(remotePortS)
      if (state === 'ESTABLISHED') established += 1
      if (state === 'ESTABLISHED' && remotePort === PORTS.origin) toOrigin += 1
      if (remotePort === PORTS.redis && state === 'ESTABLISHED') redisPorts.push(localPort)
      const accepted = localPort === PORTS.rest || localPort === PORTS.side
      const allowedOut = remotePort === PORTS.origin || remotePort === PORTS.redis
      // Every peer must be on loopback, and outbound only to the origin or the bench Redis.
      if (!LOOPBACK.has(remoteHost) || (!accepted && !allowedOut))
        this.foreign.push({ t, peer: `${proto.toLowerCase()} ${remoteHost}:${remotePort}` })
    }
    if (lsof.ok)
      this.lsof.push({ t, established, toOrigin, redisPorts: redisPorts.sort().join(','), listen })
    // A failed read is null, never 0: a 0 must mean netstat answered and found none.
    this.timeWait.push({
      t,
      n:
        netstat.ok && /^[1-9]\d* \d+$/.test(netstat.out) ? Number(netstat.out.split(' ')[1]) : null,
      err: !netstat.ok
        ? `${netstat.code} ${netstat.timedOut ? 'timeout' : netstat.err.slice(0, 120)}`
        : /^0 /.test(netstat.out)
          ? 'netstat showed no origin LISTEN line (empty table)'
          : undefined
    })
    this.redis.push(
      info ? { t, ok: true, ops: info.opsPerSec, clients: info.connectedClients } : { t, ok: false }
    )
    if (side)
      this.side.push({
        t,
        inflight: side.inflight,
        heapMiB: side.heapUsed / 2 ** 20,
        rssMiB: side.rss / 2 ** 20,
        lagMax: side.lag?.max ?? 0,
        blocked: side.blocked
      })
    if (origin) this.origin.push({ t, active: origin.active, streaming: origin.streaming })
  }

  async stop() {
    this.running = false
    await Promise.all(this.done)
  }

  slice(from: number, to: number) {
    const inW = <T extends { t: number }>(xs: T[]) => xs.filter((x) => x.t >= from && x.t <= to)
    return {
      ps: inW(this.ps),
      lsof: inW(this.lsof),
      foreign: inW(this.foreign),
      timeWait: inW(this.timeWait),
      redis: inW(this.redis),
      side: inW(this.side),
      origin: inW(this.origin)
    }
  }
}

const sampler = new Sampler()
let currentDriverPid = 0
let originPid = 0

// ---------- /metrics histograms ----------

type Hist = Map<string, Map<string, number>>
const parseMetrics = (text: string): Hist => {
  const hist: Hist = new Map()
  for (const line of text.split('\n')) {
    if (!line.startsWith('http_request_duration_seconds_bucket{')) continue
    const labels = Object.fromEntries(
      [...line.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]])
    )
    const value = Number(line.slice(line.lastIndexOf(' ') + 1))
    const key = `${labels.method} ${labels.route} ${labels.status}`
    if (!hist.has(key)) hist.set(key, new Map())
    hist.get(key)!.set(labels.le, value)
  }
  return hist
}
const scrapeMetrics = async (): Promise<Hist> => {
  try {
    const res = await fetch(`${REST}/metrics`, { signal: AbortSignal.timeout(2000) })
    return parseMetrics(await res.text())
  } catch {
    return new Map()
  }
}
/** Server-side count and bucket-bound quantiles per route, as the step's delta. */
const histDelta = (before: Hist, after: Hist) => {
  const out: Record<string, { count: number; p50Le: string; p95Le: string; p99Le: string }> = {}
  for (const [key, buckets] of after) {
    if (key.includes('/health') && !key.includes('live')) continue
    const prev = before.get(key) ?? new Map()
    const les = [...buckets.keys()].sort((a, b) =>
      a === '+Inf' ? 1 : b === '+Inf' ? -1 : Number(a) - Number(b)
    )
    const cum = les.map((le) => (buckets.get(le) ?? 0) - (prev.get(le) ?? 0))
    const count = cum.at(-1) ?? 0
    if (count <= 0) continue
    const q = (p: number) => les[cum.findIndex((c) => c >= p * count)] ?? '+Inf'
    out[key] = { count, p50Le: q(0.5), p95Le: q(0.95), p99Le: q(0.99) }
  }
  return out
}

// ---------- scenarios ----------

interface StepSpec {
  label: string
  series: string
  control?: boolean
  /** Discarded warm-up step at the first rate: the cold process never sets the reference. */
  prime?: boolean
  /** A capacity step must not meet the limiter: any 429 voids it. */
  capacity?: boolean
  /** Saturation signals this step causes on purpose (they never void it). */
  designed?: string[]
  driver: Omit<DriverConfig, 'run' | 'base' | 'timeoutMs' | 'ip'> &
    Partial<Pick<DriverConfig, 'ip' | 'base'>>
  /** Seconds after the window starts. */
  actions?: { atS: number; run: 'pause-redis' | 'unpause-redis' }[]
}
interface Plan {
  steps: StepSpec[]
  prepare?: (session: string) => Promise<void>
  checks: 'miss' | 'hit' | 'none'
  /** Scenarios that serve `page/` heads: a missing corpus voids the step. */
  needsCorpus?: boolean
}

// A full card: anything else that comes back (a fallback card) counts as degraded.
const FULL_CARD: Lane['expect'] = { status: 200, noFallback: true }
const meta = (
  name: string,
  target: string,
  weight = 1,
  route = '/api/metadata',
  param = 'url',
  expect: Lane['expect'] = FULL_CARD
): Lane => ({
  name,
  route,
  param,
  target,
  weight,
  expect
})
const pick = (full: number[], small: number[]) => ratesOverride ?? (smoke ? small : full)
/** Long enough for MIN_N samples where the budget allows: a p99 from fewer is close to the max. */
const durFor = (rate: number, full: number, small = 3) =>
  stepOverride ?? (smoke ? small : Math.max(full, Math.min(30, Math.ceil(MIN_N / rate))))
const warm = (full: number, small = 1) => warmupOverride ?? (smoke ? small : full)
const rampIp: DriverConfig['ip'] = ipOverride ?? 'pool'
const openSteps = (
  series: string,
  rates: number[],
  lanes: Lane[],
  fullS: number,
  warmupS: number,
  extra: Partial<StepSpec> = {}
): StepSpec[] =>
  rates.map((rate) => ({
    label: `${series}@${rate}`,
    series,
    capacity: true,
    ...extra,
    driver: { mode: 'open', rate, durationS: durFor(rate, fullS), warmupS, lanes, ip: rampIp }
  }))

const hitKeys = (s: string) => `http://203.0.113.20/page/hit-${s}-{k:50}?d=0`
const warmHits = async (s: string) => {
  for (let k = 0; k < 50; k++) {
    const target = `http://203.0.113.20/page/hit-${s}-${k}?d=0`
    await fetch(`${REST}/api/metadata?url=${encodeURIComponent(target)}`, {
      headers: { 'accept-language': 'en' }
    })
  }
}

const plans = (s: string): Record<string, () => Plan> => ({
  'lag-probe': () => ({ steps: [], checks: 'none' }),
  step0: () => ({ steps: [], checks: 'none' }),
  'ceiling-health': () => ({
    checks: 'none',
    steps: [
      ...openSteps(
        'rest-health',
        pick([1000, 4000, 8000, 16000], [200, 1000]),
        [{ name: 'health', route: '/health/live' }],
        10,
        warm(2)
      ),
      ...openSteps(
        'origin-direct',
        pick([1000, 4000, 8000, 16000], [200, 1000]),
        [
          {
            name: 'origin',
            route: '/page/{run}-{seq}?d=0',
            base: ORIGIN,
            headers: { 'x-bench-host': '203.0.113.5' }
          }
        ],
        10,
        warm(2)
      )
    ]
  }),
  hit: () => ({
    checks: 'hit',
    needsCorpus: true,
    prepare: warmHits,
    steps: openSteps(
      'hit',
      pick([200, 400, 800, 1600, 3200, 6400, 12800], [50, 200]),
      [meta('hit', hitKeys(s))],
      15,
      warm(3)
    )
  }),
  'miss-fast': () => ({
    checks: 'miss',
    needsCorpus: true,
    steps: openSteps(
      'miss-fast',
      pick([100, 200, 400, 800, 1600, 3200, 6400], [20, 50]),
      [meta('miss', 'http://{host}/page/{run}-{seq}?d=0')],
      15,
      warm(3)
    )
  }),
  'miss-real': () => ({
    checks: 'miss',
    needsCorpus: true,
    steps: openSteps(
      'miss-real',
      pick([100, 200, 400, 700, 1000], [10, 25]),
      [meta('miss-real', 'http://{host}/page/{run}-{seq}?dist=real')],
      20,
      warm(5, 2)
    )
  }),
  hang: () => {
    const fast = smoke ? 3 : 20
    const hangRates = ratesOverride ?? (smoke ? [3] : [5, 20, 40, 80])
    return {
      checks: 'none',
      needsCorpus: true,
      steps: hangRates.map((h) => ({
        label: `hang@${h}+fast@${fast}`,
        series: 'hang',
        capacity: true,
        designed: ['upstream-timeouts'],
        driver: {
          mode: 'open' as const,
          rate: h + fast,
          durationS: durFor(fast, 20, 4),
          // 8 s html timeout: the warm-up must outlast it to reach steady state.
          warmupS: warm(10, 2),
          ip: rampIp,
          lanes: [
            // The hang lane ends in a fallback card by design: no expectation.
            meta('hang', 'http://{host}/hang/{run}-{seq}', h, '/api/metadata', 'url', undefined),
            meta('fast', 'http://{host}/page/{run}-{seq}?d=0', fast)
          ]
        }
      }))
    }
  },
  huge: () => ({
    checks: 'none',
    steps: openSteps(
      'huge',
      pick([25, 50, 100, 200, 400], [5]),
      [
        meta('huge-head', 'http://{host}/huge/head/{run}-{seq}'),
        meta('huge-body', 'http://{host}/huge/body/{run}-{seq}')
      ],
      15,
      warm(3)
    )
  }),
  hostile: () => ({
    checks: 'none',
    steps: openSteps(
      'hostile',
      pick([12, 24, 48, 96, 192], [6]),
      [
        ...HOSTILE_VECTORS.map((v) => meta(v, `http://{host}/hostile/${v}/{run}-{seq}`)),
        // A `/jobs/` path runs the JobPosting body pass (256 KiB or 1 s) on a 1 MiB body.
        meta('job-body', 'http://{host}/jobs/{run}-{seq}')
      ],
      15,
      warm(3)
    )
  }),
  image: () => ({
    checks: 'none',
    steps: openSteps(
      'image',
      pick([10, 25, 50, 100, 200], [5]),
      // Each image streams over 2.5 s (under the 5 s relay timeout), so relays pile up in flight.
      // A 204 (the 5 s relay timeout) or a cut body is degraded, not an answer.
      [
        meta(
          'image',
          'http://{host}/imgpage/{run}-{seq}?slow=2500',
          1,
          '/api/metadata/image',
          'url',
          {
            status: 200,
            bytes: 2093056
          }
        )
      ],
      15,
      warm(3)
    )
  }),
  icon: () => ({
    checks: 'none',
    steps: openSteps(
      'icon',
      pick([100, 200, 400, 800, 1600, 3200], [20]),
      [
        meta('icon', 'http://{host}', 1, '/api/metadata/icon', 'origin', {
          status: 200,
          bytes: 1150
        })
      ],
      15,
      warm(3)
    )
  }),
  herd: () => ({
    checks: 'none',
    needsCorpus: true,
    steps: (ratesOverride ?? (smoke ? [10, 50] : [10, 50, 200, 500])).map((size) => ({
      label: `herd@${size}`,
      series: 'herd',
      capacity: true,
      driver: {
        mode: 'burst' as const,
        burst: { size, rounds: smoke ? 2 : 5, gapMs: 100 },
        durationS: 0,
        warmupS: 0,
        ip: rampIp,
        lanes: [meta('herd', `http://203.0.113.30/page/herd-${s}-${size}-{round}?d=300`)]
      }
    }))
  }),
  'redis-stall': () => {
    const pauseAt = smoke ? 3 : 8
    const pauseFor = smoke ? 4 : 10
    const rate = ratesOverride?.[0] ?? (smoke ? 10 : 50)
    // The stall degrades answers by design, so these lanes carry no expectation.
    const lanes: Lane[] = [
      meta('miss', 'http://{host}/page/{run}-{seq}?d=0', 1, '/api/metadata', 'url', undefined),
      meta('hit', hitKeys(s), 1, '/api/metadata', 'url', undefined),
      meta('pad', `http://${PAD_HOST}/page/{run}-{seq}?d=0`, 1, '/api/metadata', 'url', undefined),
      { name: 'health', route: '/health/live', weight: 0.5 }
    ]
    // Production always passes the limiter (Traefik sets x-real-ip): `pool` is that path.
    return {
      checks: 'none',
      needsCorpus: true,
      prepare: warmHits,
      steps: (['none', 'pool'] as const).map((ip) => ({
        label: `redis-stall-ip-${ip}@${rate}`,
        series: `redis-stall-ip-${ip}`,
        designed: ['redis-stall', 'redis-log'],
        driver: {
          mode: 'open' as const,
          rate,
          durationS: smoke ? 12 : 30,
          warmupS: warm(3),
          lanes,
          ip
        },
        actions: [
          { atS: pauseAt, run: 'pause-redis' as const },
          { atS: pauseAt + pauseFor, run: 'unpause-redis' as const }
        ]
      }))
    }
  },
  limiter: () => {
    const rate = ratesOverride?.[0] ?? (smoke ? 30 : 200)
    const lanes = [meta('hit', hitKeys(s))]
    // One address spends its points by design: a 429 is the designed answer, not degraded.
    const oneIpExpect = { ...FULL_CARD, designedStatus: [429] }
    const oneIpLanes = [meta('hit', hitKeys(s), 1, '/api/metadata', 'url', oneIpExpect)]
    const d = smoke ? 4 : 15
    return {
      checks: 'none',
      needsCorpus: true,
      prepare: warmHits,
      steps: [
        {
          label: `limiter-off@${rate}`,
          series: 'limiter-price',
          driver: { mode: 'open', rate, durationS: d, warmupS: warm(3), lanes, ip: 'none' }
        },
        {
          label: `limiter-pool@${rate}`,
          series: 'limiter-price',
          driver: { mode: 'open', rate, durationS: d, warmupS: warm(3), lanes, ip: 'pool' }
        },
        {
          label: `limiter-many-ips@${rate}`,
          series: 'limiter-price',
          driver: { mode: 'open', rate, durationS: d, warmupS: warm(3), lanes, ip: 'many' }
        },
        // RATE_LIMIT_MAX x 10 points per 15 min: 5000 at the prod value, so 30 s at 200/s passes it.
        {
          label: `limiter-one-ip@${rate}`,
          series: 'limiter-429',
          designed: ['limiter-429'],
          driver: {
            mode: 'open',
            rate,
            durationS: smoke ? 4 : 30,
            warmupS: warm(1),
            lanes: oneIpLanes,
            ip: 'fixed'
          }
        }
      ]
    }
  },
  aa: () => {
    const rate = ratesOverride?.[0] ?? (smoke ? 30 : 200)
    const lanes = [meta('miss', 'http://{host}/page/{run}-{seq}?d=0')]
    return {
      checks: 'miss',
      needsCorpus: true,
      // 30 s even in --smoke: with 3 s blocks that is 10 blocks, enough for an SE (B4).
      steps: ['A', 'A2'].map((label) => ({
        label,
        series: 'aa',
        capacity: true,
        driver: {
          mode: 'open' as const,
          rate,
          durationS: stepOverride ?? 30,
          warmupS: warm(3),
          lanes,
          ip: rampIp
        }
      }))
    }
  }
})

/** Adds the discarded priming step and the closing control to every ramp series. */
const shapePlan = (plan: Plan) => {
  if (concurrencyRamp) {
    const [template] = plan.steps
    plan.steps = concurrencyRamp.map((c) => ({
      ...template,
      label: `${template.series}@c${c}`,
      series: `${template.series}-closed`,
      driver: {
        ...template.driver,
        mode: 'closed',
        concurrency: c,
        rate: undefined,
        durationS: stepOverride ?? (smoke ? 3 : 15)
      }
    }))
  }
  if (order === 'reverse') {
    const bySeries = new Map<string, StepSpec[]>()
    for (const st of plan.steps) bySeries.set(st.series, [...(bySeries.get(st.series) ?? []), st])
    plan.steps = [...bySeries.values()].flatMap((list) => list.reverse())
  }
  // A/A had A' cheaper than A in 3 of 3 sessions: a cold first half. Prime it, add no control.
  if (scenario === 'aa' && plan.steps.length > 0) {
    const first = plan.steps[0]
    plan.steps = [
      {
        ...first,
        label: 'A-warmup',
        prime: true,
        driver: { ...first.driver, durationS: smoke ? 2 : 5 }
      },
      ...plan.steps
    ]
  }
  if (NO_CONTROL.has(scenario)) return plan
  const out: StepSpec[] = []
  const seen = new Set<string>()
  for (const st of plan.steps) {
    if (seen.has(st.series)) continue
    seen.add(st.series)
    const steps = plan.steps.filter((x) => x.series === st.series)
    const first = steps[0]
    out.push({
      ...first,
      label: `${first.label}-prime`,
      prime: true,
      driver: { ...first.driver, durationS: smoke ? 2 : 5, warmupS: first.driver.warmupS }
    })
    out.push(...steps)
    if (!concurrencyRamp) out.push({ ...first, label: `${first.label}-control`, control: true })
  }
  plan.steps = out
  return plan
}

/** Worst case: boot and idle baseline, each step's warm-up, window, full drain and gap, teardown. */
const budgetOf = (plan: Plan) =>
  30 +
  plan.steps.reduce(
    (sum, st) =>
      sum +
      st.driver.warmupS +
      st.driver.durationS +
      DRIVER_TIMEOUT_MS / 1000 +
      3 +
      (st.control ? CONTROL_REST_S : 0),
    0
  ) +
  15

/** Per-address points a session spends, so RATE_LIMIT_MAX can sit above it (no 429 in a ramp). */
const rateLimitFor = (plan: Plan) => {
  const given = flag('rate-limit-max')
  if (given) return given
  if (smoke && scenario === 'limiter') return '5'
  if (scenario === 'limiter') return '500'
  let perAddress = 0
  for (const st of plan.steps) {
    const d = st.driver
    const n =
      d.mode === 'burst'
        ? (d.burst?.size ?? 0) * (d.burst?.rounds ?? 0)
        : d.mode === 'closed'
          ? 20_000 * (d.warmupS + d.durationS)
          : (d.rate ?? 0) * (d.warmupS + d.durationS)
    if (d.ip === 'pool') perAddress += n / 64
    if (d.ip === 'fixed') perAddress += n
  }
  // Points are RATE_LIMIT_MAX x 10 per 15 min; 1.5x headroom.
  return String(Math.max(500, Math.ceil((perAddress * 1.5) / 10)))
}

// ---------- step execution ----------

let idleCpuUsPerS = 0
let restLogOffset = 0
let restLogPath = ''
const REDIS_LOG_ERROR =
  /ECONNREFUSED 127\.0\.0\.1:6391|Connection is closed|MaxRetriesPerRequest|Redis connection error|"err":\{[^}]*ioredis/g

const readRestLogTail = () => {
  try {
    const buf = readFileSync(restLogPath)
    const stderr = existsSync(`${restLogPath}.stderr`)
      ? readFileSync(`${restLogPath}.stderr`, 'utf8')
      : ''
    const text = buf.subarray(restLogOffset).toString('utf8')
    restLogOffset = buf.length
    return { text, stderr }
  } catch {
    return { text: '', stderr: '' }
  }
}

const runDriverStep = async (cfg: DriverConfig, actions: StepSpec['actions']) => {
  const stepsDir = join(outDir, 'steps')
  const cfgPath = join(stepsDir, `${cfg.run}.driver.json`)
  writeFileSync(cfgPath, JSON.stringify(cfg))
  readRestLogTail()
  let before: Hist = new Map()
  await getJson(`${ORIGIN}/__stats?resetAll=1`)
  const thermBefore = (await run(['pmset', '-g', 'therm'], 3000)).out
  let cpuAtStart: Promise<CpuSnap | null> = Promise.resolve(null)
  const driver = spawnChild([process.execPath, join(BENCH_DIR, 'driver.ts'), cfgPath], {
    // The driver must never be the bottleneck: lift Bun's 256 concurrent fetch default.
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      HOME: process.env.HOME ?? '/tmp',
      BUN_CONFIG_MAX_HTTP_REQUESTS: '16384',
      BENCH_PARENT_PID: String(process.pid)
    },
    stdout: 'pipe',
    stderr: 'inherit'
  })
  currentDriverPid = driver.pid
  let side0: any = null
  let side1: any = null
  let wall0 = 0
  let wall1 = 0
  let cmd0: Record<string, number> | null = null
  let cmd1: Record<string, number> | null = null
  let result: any = null
  const actionTimers: Promise<void>[] = []
  const actionLog: { run: string; at: number }[] = []
  let cpuAtEnd: Promise<CpuSnap | null> = Promise.resolve(null)

  const decoder = new TextDecoder()
  let pending = ''
  for await (const chunk of driver.stdout as ReadableStream<Uint8Array>) {
    pending += decoder.decode(chunk)
    let nl: number
    while ((nl = pending.indexOf('\n')) !== -1) {
      const line = pending.slice(0, nl)
      pending = pending.slice(nl + 1)
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.event === 'window-start') {
        await getJson(`${ORIGIN}/__stats?reset=1`)
        // Same window as the client: warm-up requests stay out of the server-side count.
        if (layer === 1) before = await scrapeMetrics()
        if (layer === 2) await getJson(`${REST}/__layer2/stats?reset=1`)
        cmd0 = await commandCalls()
        side0 = await getJson(`${SIDE}/stats?reset=1`)
        cpuAtStart = cpuSnapshot()
        wall0 = now()
        for (const a of actions ?? []) {
          actionTimers.push(
            sleep(a.atS * 1000).then(async () => {
              await pauseRedis(a.run === 'pause-redis')
              actionLog.push({ run: a.run, at: round((now() - wall0) / 1000) })
            })
          )
        }
      } else if (msg.event === 'window-end') {
        side1 = await getJson(`${SIDE}/stats`, 3000)
        wall1 = now()
        cpuAtEnd = cpuSnapshot()
      } else if (msg.event === 'result') result = msg.result
    }
  }
  await driver.exited
  currentDriverPid = 0
  await Promise.all(actionTimers)
  cmd1 = await commandCalls()
  const origin = await getJson(`${ORIGIN}/__stats?match=${encodeURIComponent(`/${cfg.run}-`)}`)
  const sideEnd = await getJson(`${SIDE}/stats`, 3000)
  const after = layer === 1 ? await scrapeMetrics() : new Map()
  const layer2 = layer === 2 ? await getJson(`${REST}/__layer2/stats?reset=1`) : undefined
  const dbsize = Number(await redisCmd(['DBSIZE'], 1000))
  const thermAfter = (await run(['pmset', '-g', 'therm'], 3000)).out
  const log = readRestLogTail()
  const commandDelta =
    cmd0 && cmd1
      ? Object.fromEntries(
          Object.entries(cmd1)
            .map(([k, v]) => [k, v - (cmd0?.[k] ?? 0)] as [string, number])
            .filter(([, v]) => v > 0)
        )
      : null
  return {
    result,
    side0,
    side1,
    sideEnd,
    wall0,
    wall1,
    samples: sampler.slice(wall0, wall1 || now()),
    origin,
    server: histDelta(before, after),
    layer2,
    actionLog,
    dbsize,
    commandDelta,
    thermalChanged: thermBefore !== thermAfter || thermBefore !== startTherm,
    otherCpuWindow: otherCpuBetween(await cpuAtStart, await cpuAtEnd),
    redisLogErrors: (log.text.match(REDIS_LOG_ERROR) ?? []).length,
    driverPid: driver.pid
  }
}

const nearest = <T extends { t: number }>(xs: T[], t: number): T | null => {
  let best: T | null = null
  for (const x of xs) if (!best || Math.abs(x.t - t) < Math.abs(best.t - t)) best = x
  return best && Math.abs(best.t - t) < 1500 ? best : null
}

const summarizeStep = (
  spec: StepSpec,
  run: Awaited<ReturnType<typeof runDriverStep>>,
  plan: Plan,
  i: number
) => {
  const r = run.result ?? {}
  const s = run.samples
  const wallS = (run.wall1 - run.wall0) / 1000
  const restPs = s.ps.filter((p) => p.pid === sampler.restPid)
  const psCpuUs = restPs.length >= 2 ? (restPs.at(-1)!.cpuS - restPs[0].cpuS) * 1e6 : NaN
  // The side port answers from the REST loop; when the loop is stalled, ps still has the CPU.
  const cpuUs =
    run.side0 && run.side1
      ? run.side1.cpuUserUs + run.side1.cpuSystemUs - run.side0.cpuUserUs - run.side0.cpuSystemUs
      : psCpuUs
  const cpuSource = run.side0 && run.side1 ? 'side' : 'ps'
  const cpuPct = round((cpuUs / 1e6 / wallS) * 100, 1)
  const completed = r.completedInWindow ?? 0
  const cpuOf = (pid: number) => {
    const xs = s.ps.filter((p) => p.pid === pid)
    return xs.length >= 2
      ? round(((xs.at(-1)!.cpuS - xs[0].cpuS) / ((xs.at(-1)!.t - xs[0].t) / 1000)) * 100, 1)
      : null
  }
  const redisOps = s.redis
    .filter((x) => x.ok)
    .map((x) => x.ops ?? 0)
    .sort((a, b) => a - b)
  const blockedDelta = run.sideEnd && run.side0 ? run.sideEnd.blocked - run.side0.blocked : null
  const errorCodes: Record<string, number> = {}
  if (run.sideEnd && run.side0)
    for (const [k, n] of Object.entries(run.sideEnd.fetchErrorCodes ?? {})) {
      const d = (n as number) - (run.side0.fetchErrorCodes?.[k] ?? 0)
      if (d > 0) errorCodes[k] = d
    }
  // Work holding a fetch slot: shim fetches waiting for headers plus origin bodies streaming,
  // matched by time. The shim count alone drops a relay once its headers arrive.
  const inUse = s.side
    .map((x) => ({ t: x.t, n: x.inflight + (nearest(s.origin, x.t)?.streaming ?? 0) }))
    .filter((x) => Number.isFinite(x.n))
  // Side memoryUsage().rss falls after a free; macOS ps RSS is a high-water mark (B1).
  const sideRss = s.side.map((x) => x.rssMiB)
  const secondHalf = s.side.filter((x) => x.t >= run.wall0 + (run.wall1 - run.wall0) / 2)
  const median = (xs: number[]) =>
    quantile(
      [...xs].sort((a, b) => a - b),
      0.5
    )
  const tRel = (t: number) => round((t - run.wall0) / 1000, 1)
  const firstAt = <T extends { t: number }>(xs: T[], test: (x: T) => boolean) => {
    const hit = xs.find(test)
    return hit ? tRel(hit.t) : null
  }
  const firstRss = sideRss[0] ?? 0
  const cpuSeries = restPs.slice(1).map((p, k) => ({
    t: p.t,
    pct: ((p.cpuS - restPs[k].cpuS) / ((p.t - restPs[k].t) / 1000)) * 100
  }))
  const restPorts = s.lsof.map((x) => x.redisPorts)
  const step = {
    type: 'step',
    session,
    run: `${session}-${i}`,
    label: spec.label,
    series: spec.series,
    control: spec.control === true,
    prime: spec.prime === true,
    capacity: spec.capacity === true,
    designed: spec.designed ?? [],
    plan: { checks: plan.checks, needsCorpus: plan.needsCorpus === true },
    transport: TRANSPORT,
    mode: spec.driver.mode,
    concurrency: spec.driver.concurrency ?? null,
    offeredRate: r.offeredRate ?? null,
    durationS: spec.driver.durationS,
    warmupS: spec.driver.warmupS,
    ip: spec.driver.ip ?? 'none',
    client: r,
    rest: {
      cpuPct,
      cpuSource,
      cpuS: round(cpuUs / 1e6, 4),
      windowS: round(wallS, 3),
      // One step at one rate; the fit across steps (footer fits.cpu) is the projection input.
      cpuSPerCompletedNet: completed
        ? round(Math.max(0, cpuUs - idleCpuUsPerS * wallS) / 1e6 / completed, 6)
        : null,
      rssMaxMiB: round(Math.max(0, ...sideRss), 1),
      rssSteadyMiB: secondHalf.length ? round(median(secondHalf.map((x) => x.rssMiB)), 1) : null,
      heapMaxMiB: round(Math.max(0, ...s.side.map((x) => x.heapMiB)), 1),
      heapSteadyMiB: secondHalf.length ? round(median(secondHalf.map((x) => x.heapMiB)), 1) : null,
      rssSource: 'side memoryUsage().rss, 1 Hz',
      psRssMaxMiB: round(Math.max(0, ...restPs.map((p) => p.rssMiB)), 1),
      psRssNote: 'macOS ps RSS keeps freed pages: a high-water mark, never compared with 512 MiB',
      inUseMean: inUse.length ? round(inUse.reduce((a, x) => a + x.n, 0) / inUse.length, 2) : null,
      outboundInUseMax: Math.max(0, ...inUse.map((x) => x.n)),
      socketsMax: Math.max(0, ...s.lsof.map((x) => x.established)),
      timeWaitToOriginMax: s.timeWait.some((x) => x.n !== null)
        ? Math.max(0, ...s.timeWait.map((x) => x.n ?? 0))
        : null,
      timeWaitReadErrors: [...new Set(s.timeWait.filter((x) => x.n === null).map((x) => x.err))],
      foreignPeers: [...new Set(s.foreign.map((x) => x.peer))],
      lagMs: run.side1
        ? {
            p50: round(run.side1.lag.p50),
            p99: round(run.side1.lag.p99),
            max: round(run.side1.lag.max),
            stalls: run.side1.lag.stalls,
            stalledFraction: round(run.side1.lag.stalledFraction, 4)
          }
        : null,
      outboundInflightMax: run.side1?.inflightMax ?? null,
      originStreamingMax: run.origin?.streamingMax ?? null,
      outboundRewrites: run.sideEnd && run.side0 ? run.sideEnd.rewrites - run.side0.rewrites : null,
      outboundFetchErrors:
        run.sideEnd && run.side0 ? run.sideEnd.fetchErrors - run.side0.fetchErrors : null,
      outboundFetchErrorCodes: errorCodes,
      blockedOutbound: blockedDelta,
      server: run.server,
      serverNote: 'histogram lowest bucket is 0.01 s: it cannot check sub-10 ms client latency'
    },
    other: {
      driverCpuPct: cpuOf(run.driverPid),
      driverCpuNote: 'the send loop spins under 2 ms to the next send, so >= 100 % is not load',
      originCpuPct: cpuOf(originPid),
      otherCpuWindow: run.otherCpuWindow
    },
    resourceTimes: {
      cpu: firstAt(cpuSeries, (x) => x.pct >= 85),
      rss: firstAt(s.side, (x) => x.rssMiB - firstRss > 128),
      'outbound-pool': firstAt(inUse, (x) => x.n >= 250),
      lag: firstAt(s.side, (x) => x.lagMax >= 45),
      'redis-stall': firstAt(s.redis, (x) => !x.ok)
    },
    redis: {
      opsPerSecP50: quantile(redisOps, 0.5),
      opsPerSecMax: redisOps.at(-1) ?? 0,
      connectedClientsMax: Math.max(0, ...s.redis.map((x) => x.clients ?? 0)),
      dbsize: run.dbsize,
      commandCalls: run.commandDelta,
      // Same REST-side local ports first and last: ioredis never reconnected (a stall, not a reset).
      restConnectionsStable:
        restPorts.length > 0 && restPorts[0] !== '' && restPorts[0] === restPorts.at(-1),
      restRedisPorts: [restPorts[0], restPorts.at(-1)],
      infoTimeouts: s.redis.filter((x) => !x.ok).length,
      restLogRedisErrors: run.redisLogErrors
    },
    origin: run.origin,
    layer2: run.layer2,
    actions: run.actionLog,
    files: {
      requests: `steps/${session}-${i}.requests.csv.gz`,
      series: `steps/${session}-${i}.series.json`
    },
    // What the pure void rules read that the step does not carry otherwise.
    inputs: {
      sideRead: !!(run.side0 && run.side1 && run.sideEnd),
      thermalChanged: run.thermalChanged,
      lsofSamples: s.lsof.length
    },
    voidRulesVersion: VOID_RULES_VERSION,
    valid: true,
    voidReasons: [] as string[]
  }
  step.voidReasons = voidReasonsOf(step)
  step.valid = step.voidReasons.length === 0
  writeFileSync(
    join(outDir, step.files.series),
    JSON.stringify({
      t0: run.wall0,
      ps: restPs.map((p) => [tRel(p.t), round(p.rssMiB, 1), p.cpuS]),
      side: s.side.map((x) => [
        tRel(x.t),
        x.inflight,
        round(x.heapMiB, 1),
        round(x.rssMiB, 1),
        round(x.lagMax, 1),
        x.blocked
      ]),
      origin: s.origin.map((x) => [tRel(x.t), x.active, x.streaming]),
      redis: s.redis.map((x) => [tRel(x.t), x.ok ? 1 : 0, x.ops ?? null, x.clients ?? null]),
      sockets: s.lsof.map((x) => [tRel(x.t), x.established, x.redisPorts]),
      columns: {
        ps: ['tS', 'psRssMiB (macOS high-water)', 'cpuS'],
        side: ['tS', 'inflight', 'heapMiB', 'rssMiB (memoryUsage)', 'lagMaxSoFarMs', 'blocked'],
        origin: ['tS', 'active', 'streaming'],
        redis: ['tS', 'ok', 'opsPerSec', 'clients'],
        sockets: ['tS', 'established', 'redisPorts']
      }
    })
  )
  return step
}

// ---------- session ----------

let startTherm = ''

/** Cumulative CPU seconds of every process, so a window's other-process CPU is exact. */
type CpuSnap = { t: number; rows: Map<number, { ppid: number; cpuS: number; comm: string }> }
const cpuSnapshot = async (): Promise<CpuSnap | null> => {
  const res = await run(['ps', '-Ao', 'pid=,ppid=,time=,comm='], 5000)
  if (!res.ok) return null
  const rows = new Map<number, { ppid: number; cpuS: number; comm: string }>()
  for (const l of res.out.split('\n')) {
    const [pid, ppid, time, ...comm] = l.trim().split(/\s+/)
    if (pid && time)
      rows.set(Number(pid), { ppid: Number(ppid), cpuS: parseCpuTime(time), comm: comm.join(' ') })
  }
  return { t: now(), rows }
}
/** CPU of every process this run did not start, between two snapshots, in % of one core. */
const otherCpuBetween = (a: CpuSnap | null, b: CpuSnap | null) => {
  if (!a || !b || b.t <= a.t) return null
  // This run and every descendant (children, ps, lsof, netstat) are not "other".
  // pid 0 (kernel_task) is every process's ancestor, so a missing Redis pid must not add it.
  const mine = new Set([process.pid, ...(own.redisPid > 0 ? [own.redisPid] : [])])
  for (let grew = true; grew;) {
    grew = false
    for (const [pid, r] of b.rows)
      if (!mine.has(pid) && mine.has(r.ppid)) {
        mine.add(pid)
        grew = true
      }
  }
  const dt = (b.t - a.t) / 1000
  // A process born inside the window spent all its CPU there.
  const other = [...b.rows]
    .filter(([pid]) => !mine.has(pid))
    .map(([pid, r]) => ({ comm: r.comm, d: r.cpuS - (a.rows.get(pid)?.cpuS ?? 0) }))
    .filter((x) => x.d > 0)
    .sort((x, y) => y.d - x.d)
  return {
    meanPct: round((other.reduce((sum, x) => sum + x.d, 0) / dt) * 100, 1),
    windowS: round(dt, 1),
    top: other.slice(0, 4).map((x) => `${round((x.d / dt) * 100, 0)} ${x.comm.split('/').pop()}`)
  }
}
/** A 3 s sample at a session edge. */
const otherCpu = async () => {
  const a = await cpuSnapshot()
  await sleep(3000)
  return otherCpuBetween(a, await cpuSnapshot())
}

const sessionFacts = async () => {
  const [revision, power, therm, head, dirty, containers, dockerVersion, pm, sys, ulimit] =
    await Promise.all([
      run([process.execPath, '--revision'], 5000),
      run(['pmset', '-g', 'batt'], 3000),
      run(['pmset', '-g', 'therm'], 3000),
      run(['git', 'rev-parse', 'HEAD'], 5000),
      run(['git', 'status', '--porcelain', '--', 'apps/hocuspocus.server', 'bun.lock'], 10_000),
      docker(['ps', '--format', '{{.Names}}'], redisBackend === 'docker' ? 15_000 : 5000),
      docker(['version', '--format', '{{.Server.Version}}'], 5000),
      run(['pmset', '-g'], 3000),
      run(
        [
          'sysctl',
          '-n',
          'kern.ipc.somaxconn',
          'hw.perflevel0.logicalcpu',
          'hw.perflevel1.logicalcpu',
          'net.inet.ip.portrange.first',
          'net.inet.ip.portrange.last',
          'net.inet.tcp.msl'
        ],
        3000
      ),
      run(['sh', '-c', 'ulimit -n'], 3000)
    ])
  const [somaxconn, pCores, eCores, portFirst, portLast, msl] = sys.out.split('\n')
  const redisNow = await redisInfo()
  return {
    bunRevision: revision.out,
    srcTree: treeHash([join(SERVER_DIR, 'src')]),
    serverPackageJson: treeHash([join(SERVER_DIR, 'package.json')]),
    bunLock: treeHash([join(ROOT, 'bun.lock')]),
    corpus: treeHash([CORPUS_DIR]),
    benchTree: treeHash([BENCH_DIR]),
    gitHead: head.out,
    gitDirty: dirty.out.split('\n').filter(Boolean),
    powerSource: power.out.split('\n')[0] ?? '',
    battery: power.out.split('\n')[1]?.trim() ?? '',
    thermal: therm.out,
    loadAvg: loadavg().map((x) => round(x)),
    otherCpu: await otherCpu(),
    // `pmset -g therm` has printed "No thermal warning level has been recorded" on this Mac,
    // with no positive control: the thermal rule cannot fire here (stated, not hidden).
    powerMode: pm.out.match(/^\s*powermode\s+(\S+)/m)?.[1] ?? 'unknown',
    somaxconn,
    cores: { performance: pCores, efficiency: eCores },
    ephemeralPorts: `${portFirst}-${portLast}`,
    tcpMslMs: msl,
    ulimitN: ulimit.out,
    redisVersion: redisNow?.version ?? null,
    docker: dockerVersion.ok
      ? dockerVersion.out
      : `unavailable (${dockerVersion.timedOut ? 'timeout' : dockerVersion.err.slice(0, 80)})`,
    containers: containers.ok ? containers.out.split('\n').filter(Boolean).sort() : null
  }
}

/** Facts that must not move inside a session; load may rise from the bench itself, so it has a band. */
const compareFacts = (a: any, b: any) => {
  const out: string[] = []
  for (const key of [
    'bunRevision',
    'srcTree',
    'serverPackageJson',
    'bunLock',
    'corpus',
    'benchTree',
    'gitHead',
    'powerSource',
    'thermal',
    'powerMode',
    'somaxconn',
    'ulimitN',
    'docker'
  ])
    if (a[key] !== b[key]) out.push(`${key} changed`)
  if (a.gitDirty.join() !== b.gitDirty.join()) out.push('git-dirty paths changed')
  // Read at the start before Redis runs: compare once both sides read it.
  if (a.redisVersion && b.redisVersion && a.redisVersion !== b.redisVersion)
    out.push('redis version changed')
  if (a.containers && b.containers && a.containers.join() !== b.containers.join())
    out.push('container set changed')
  if (b.loadAvg[0] > a.loadAvg[0] + 8) out.push(`load rose ${a.loadAvg[0]} -> ${b.loadAvg[0]}`)
  // Another session's load moved one smoke's p50 2.5x while load rose by only 1.5 (2026-11-14).
  for (const [when, f] of [
    ['start', a],
    ['end', b]
  ] as const)
    if (!f.otherCpu || f.otherCpu.meanPct > OTHER_CPU_LIMIT_PCT)
      out.push(
        `other processes used ${f.otherCpu?.meanPct ?? '?'} % CPU over 3 s at ${when} (${f.otherCpu?.top.join(', ') ?? 'unread'})`
      )
  return out
}

const restEnv = (rateLimitMax: string, canaryPort: number): Record<string, string> => ({
  PATH: process.env.PATH ?? '/usr/bin:/bin',
  HOME: process.env.HOME ?? '/tmp',
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  APP_PORT: String(PORTS.rest),
  REDIS: 'true',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: String(PORTS.redis),
  // Placeholders on dead ports: these routes never touch Postgres or Supabase.
  DATABASE_URL: 'postgresql://bench:bench@127.0.0.1:1/bench',
  SUPABASE_URL: 'http://127.0.0.1:1',
  SUPABASE_ANON_KEY: 'bench-placeholder',
  GLITCHTIP_DSN: '',
  RATE_LIMIT_MAX: rateLimitMax,
  // TEST-NET-1: never the production domain, even as a string in a fallback card.
  APP_URL: 'http://192.0.2.250',
  // One bench host serves "pads", so pad URLs take the generation read. {host} never picks it.
  APP_HOSTS: PAD_HOST,
  BENCH_ORIGIN_URL: ORIGIN,
  BENCH_SIDE_PORT: String(PORTS.side),
  BENCH_VARIANT: variant,
  BENCH_CONN: conn,
  BENCH_CANARY_PORT: String(canaryPort),
  BENCH_PARENT_PID: String(process.pid)
})

/** The runner's canary: REST must fail to reach it, and it must accept nothing. */
const canary = { accepted: 0, port: 0, stop: () => {} }
const fenceCheck = async () => {
  const before = canary.accepted
  const probe = await getJson(`${SIDE}/connect-probe?port=${canary.port}`, 3000)
  await sleep(200)
  const pass =
    String(probe?.outcome).startsWith('error') && probe?.ms < 100 && canary.accepted === before
  return { pass, probe, canaryAccepted: canary.accepted - before, canaryPort: canary.port }
}

/** STEP 0: proves the hinge, one JSON line per probe. Every probe names what it expects. */
const runStep0 = async (write: (obj: unknown) => void, allowForeign: Set<string>) => {
  const call = async (target: string, route = '/api/metadata', param = 'url') => {
    const start = now()
    const res = await fetch(`${REST}${route}?${param}=${encodeURIComponent(target)}`, {
      headers: { 'accept-language': 'en' }
    })
    const type = res.headers.get('content-type') ?? ''
    const card: any = type.includes('json') ? await res.json() : null
    const bytes = card ? 0 : (await res.arrayBuffer()).byteLength
    return { status: res.status, type, ms: round(now() - start), card, bytes }
  }
  let failures = 0
  const probe = (name: string, expect: string, pass: boolean, observed: unknown) => {
    if (!pass) failures += 1
    write({ type: 'step0', session, probe: name, expect, pass, observed })
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(observed).slice(0, 200)}`)
  }
  const slow = Promise.all([
    call('http://203.0.113.7/trickle/s0'),
    call('http://203.0.113.7/hang/s0')
  ])

  const first = await call('http://203.0.113.7/page/s0-card')
  probe(
    'card-url-host',
    'card.url keeps 203.0.113.7, cached false',
    first.card?.url === 'http://203.0.113.7/page/s0-card' && first.card?.cached === false,
    {
      url: first.card?.url,
      cached: first.card?.cached,
      title: first.card?.title
    }
  )
  const again = await call('http://203.0.113.7/page/s0-card')
  probe('cache-hit', 'second call cached true', again.card?.cached === true, {
    cached: again.card?.cached
  })
  const redirect = await call('http://203.0.113.7/redirect/s0-redirect')
  const landed = await getJson(
    `${ORIGIN}/__stats?match=${encodeURIComponent('203.0.113.8/page/s0-redirect-landed')}`
  )
  probe(
    'redirect-through-shim',
    'card.url is the landed bench host; origin saw x-bench-host 203.0.113.8',
    redirect.card?.url === 'http://203.0.113.8/page/s0-redirect-landed' &&
      redirect.card?.fallback !== true &&
      landed?.match?.hits === 1,
    { url: redirect.card?.url, originSawLandedHost: landed?.match?.hits }
  )
  const icon = await call('http://203.0.113.7', '/api/metadata/icon', 'origin')
  probe(
    'icon-ip-origin',
    'iconSiteOrigin keeps an IP origin: 200 image/x-icon 1150 B',
    icon.status === 200 && icon.type === 'image/x-icon' && icon.bytes === 1150,
    icon
  )
  const image = await call('http://203.0.113.7/imgpage/s0-image', '/api/metadata/image')
  probe(
    'image-relay',
    '200 image/png 2093056 B (under the 2 MiB cap)',
    image.status === 200 && image.type === 'image/png' && image.bytes === 2093056,
    image
  )
  const s500 = await call('http://203.0.113.7/status/500/s0')
  probe(
    'status-500',
    'fallback, miss unreachable',
    s500.card?.fallback === true && s500.card?.miss === 'unreachable',
    { miss: s500.card?.miss }
  )
  const s404 = await call('http://203.0.113.7/status/404/s0')
  probe(
    'status-404',
    'fallback, miss blocked',
    s404.card?.fallback === true && s404.card?.miss === 'blocked',
    { miss: s404.card?.miss }
  )
  const hugeHead = await call('http://203.0.113.7/huge/head/s0')
  const hugeBody = await call('http://203.0.113.7/huge/body/s0')
  probe(
    'huge',
    'both parse: titles "Huge head" and "Huge body"',
    hugeHead.card?.title === 'Huge head' && hugeBody.card?.title === 'Huge body',
    {
      head: [hugeHead.card?.title, hugeHead.ms],
      body: [hugeBody.card?.title, hugeBody.ms]
    }
  )
  // A /jobs/ path runs the JobPosting body pass. Its posting sits 64 KiB into the body, past
  // the head cut, so only the body pass can give the card its `work` fact.
  const job = await call('http://203.0.113.7/jobs/s0-job?near=1')
  probe(
    'job-body-pass',
    'a /jobs/ page with its posting 64 KiB into the body: full card with a work fact',
    job.status === 200 &&
      job.card?.fallback !== true &&
      (job.card?.facts ?? []).some((f: any) => f.icon === 'work'),
    { title: job.card?.title, facts: job.card?.facts, ms: job.ms }
  )
  const pad = await call(`http://${PAD_HOST}/page/s0-pad`)
  const padKeys =
    (await redisCmd(['EVAL', "return #redis.call('KEYS', ARGV[1])", '0', 'meta:v4:*:g0'])) ?? ''
  probe(
    'pad-generation-read',
    `a ${PAD_HOST} URL is a pad: its key ends in :g0`,
    pad.card?.cached === false && Number(padKeys) > 0,
    { padKeysWithGeneration: Number(padKeys) }
  )

  const before = await getJson(`${SIDE}/stats`)
  const blocked = await call('http://192.0.2.1/s0')
  const after = await getJson(`${SIDE}/stats`)
  probe(
    'blocked-positive-control',
    'TEST-NET-1 fetch blocked: counter +1, fallback unreachable',
    after.blocked - before.blocked === 1 && blocked.card?.miss === 'unreachable',
    {
      blockedDelta: after.blocked - before.blocked,
      hosts: after.blockedHosts
    }
  )

  // The sandbox fence: a raw socket from REST to the runner's loopback canary must fail at
  // once and the canary must accept nothing. Unfenced it would open, so this tells them apart
  // without a packet off the machine.
  const fence = await fenceCheck()
  probe(
    'fence-positive-control',
    'raw connect to the canary 127.0.0.1 port refused in under 100 ms; canary accepted 0',
    fence.pass,
    fence
  )

  // The foreign-peer detector: REST holds a socket to its own side port, which the fence
  // allows and the sampler must flag, because 4622 is not the origin or Redis.
  const peer = `tcp 127.0.0.1:${PORTS.side}`
  allowForeign.add(peer)
  const connect = getJson(`${SIDE}/connect-probe?port=${PORTS.side}&hold=3000`, 3000)
  await sleep(2600)
  const seen = sampler.foreign.some((f) => f.peer === peer)
  probe(
    'foreign-peer-positive-control',
    `the sampler flags REST's peer ${peer}`,
    seen && String((await connect)?.outcome) === 'open',
    { seen, connected: await connect }
  )
  await sleep(600)

  // The sampler reads REST's own sockets: the calls above held origin sockets.
  probe(
    'sampler-sees-origin-sockets',
    'lsof saw at least one ESTABLISHED REST socket to the origin 127.0.0.1:4621',
    sampler.lsof.some((x) => x.toOrigin > 0),
    { maxToOrigin: Math.max(0, ...sampler.lsof.map((x) => x.toOrigin)) }
  )

  const listen = sampler.lsof.at(-1)?.listen ?? []
  probe(
    'listen-loopback',
    'REST listens on 127.0.0.1 only',
    listen.length > 0 && listen.every((l) => l.startsWith('127.0.0.1:')),
    listen
  )

  const [trickle, hang] = await slow
  probe(
    'trickle',
    'html stage times out near 8 s: fallback unreachable',
    trickle.card?.miss === 'unreachable' && trickle.ms > 7500 && trickle.ms < 9500,
    {
      miss: trickle.card?.miss,
      ms: trickle.ms
    }
  )
  probe(
    'hang',
    'html stage times out near 8 s: fallback unreachable',
    hang.card?.miss === 'unreachable' && hang.ms > 7500 && hang.ms < 9500,
    {
      miss: hang.card?.miss,
      ms: hang.ms
    }
  )
  return failures
}

/** Proves the lag flag: single blocks, then periodic blocks that p99 cannot see. */
const runLagProbe = async (write: (obj: unknown) => void) => {
  const single = []
  for (const ms of [50, 50, 100]) {
    await getJson(`${SIDE}/stats?reset=1`)
    await sleep(300)
    await getJson(`${SIDE}/sabotage?ms=${ms}`, 3000)
    await sleep(300)
    const s = await getJson(`${SIDE}/stats`)
    single.push({
      injectedMs: ms,
      reportedMaxMs: round(s.lag.max),
      stalls: s.lag.stalls,
      detected: s.lag.max >= ms - 5
    })
  }
  const periodic = []
  for (const perS of [1, 2, 4]) {
    await getJson(`${SIDE}/stats?reset=1`)
    const start = now()
    for (let k = 0; k < 5 * perS; k++) {
      await sleep(Math.max(0, start + (k * 1000) / perS - now()))
      await getJson(`${SIDE}/sabotage?ms=60`, 3000)
    }
    await sleep(Math.max(0, start + 5000 - now()))
    const s = await getJson(`${SIDE}/stats`)
    periodic.push({
      blocksPerS: perS,
      blockMs: 60,
      injected: 5 * perS,
      expectedFraction: round(0.06 * perS, 3),
      p99: round(s.lag.p99),
      max: round(s.lag.max),
      stalls: s.lag.stalls,
      stalledFraction: round(s.lag.stalledFraction, 4),
      p99Flag: s.lag.p99 > 50,
      maxFlag: s.lag.max > 50
    })
  }
  await getJson(`${SIDE}/stats?reset=1`)
  await sleep(2000)
  const idle = await getJson(`${SIDE}/stats`)
  const pass =
    single.every((x) => x.detected && x.stalls >= 1) &&
    periodic.every(
      (x) =>
        x.maxFlag &&
        x.stalls >= x.injected - 1 &&
        Math.abs(x.stalledFraction - x.expectedFraction) < 0.03
    )
  write({
    type: 'lag-probe',
    session,
    single,
    periodic,
    idleBaseline: idle.lag,
    pass,
    note: 'tick is 5 ms, so the probe reads up to 5 ms low'
  })
  console.log(JSON.stringify({ single, periodic, pass }))
  return pass ? 0 : 1
}

const main = async () => {
  // Unfenced, a shim bypass reaches the LAN: 192.0.2.1:80 answered here (review, 2026-11-14).
  if (has('no-fence')) {
    console.error('refused: --no-fence was removed. Measure the fence cost with fence-cost.ts.')
    process.exitCode = 2
    return
  }
  if (has('keep-redis') && redisBackend === 'native') {
    console.error(
      'refused: --keep-redis applies to the container only; a kept native Redis blocks 6391'
    )
    process.exitCode = 2
    return
  }
  const known = plans('x')
  if (!known[scenario]) {
    console.error(`usage: run.ts <${Object.keys(known).join('|')}> [--smoke] ...`)
    process.exitCode = 2
    return
  }
  const plan = shapePlan(plans(session)[scenario]())
  const rateLimitMax = rateLimitFor(plan)
  const budgetS = budgetOf(plan)
  if (dryRun) {
    console.log(
      JSON.stringify({
        scenario,
        steps: plan.steps.map(
          (st) =>
            `${st.label} ${st.driver.mode} ${st.driver.rate ?? st.driver.concurrency ?? st.driver.burst?.size} ${st.driver.durationS}s ip:${st.driver.ip}`
        ),
        budgetS,
        rateLimitMax
      })
    )
    return
  }
  if (budgetS > SESSION_BUDGET_S && !has('force-long')) {
    console.error(
      `plan worst case ${budgetS} s is over ${SESSION_BUDGET_S} s; cut steps or pass --force-long`
    )
    process.exitCode = 2
    return
  }

  // Lock first, then checks: a refused start owns nothing and tears nothing down.
  const lockError = await acquireLock()
  if (lockError) {
    console.error(`refused: ${lockError}`)
    process.exitCode = 3
    return
  }
  for (const [name, port] of Object.entries({
    rest: PORTS.rest,
    origin: PORTS.origin,
    side: PORTS.side
  })) {
    if (await portBusy(port)) {
      console.error(`refused: port ${port} (${name}) is busy; stop the old bench process first`)
      process.exitCode = 3
      return
    }
  }
  mkdirSync(join(outDir, 'logs'), { recursive: true })
  mkdirSync(join(outDir, 'steps'), { recursive: true })
  jsonlPath = join(outDir, `${scenario}.jsonl`)
  // Nothing lands after a footer: a torn-down session stays closed.
  const write = (obj: unknown) => {
    if (!own.footerWritten) appendFileSync(jsonlPath, `${JSON.stringify(obj)}\n`)
  }

  const startFacts = await sessionFacts()
  startTherm = startFacts.thermal
  const redis = await startRedis()
  await redisCmd(['FLUSHALL'], 2000) // our own Redis only: startRedis proved it

  const originLog = join(outDir, 'logs', `${scenario}-${session}.origin.log`)
  const origin = spawnChild([process.execPath, join(BENCH_DIR, 'origin.ts')], {
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      HOME: process.env.HOME ?? '/tmp',
      BENCH_ORIGIN_PORT: String(PORTS.origin),
      BENCH_SEED: scenario,
      BENCH_PARENT_PID: String(process.pid)
    },
    stdout: Bun.file(originLog),
    stderr: 'inherit'
  })
  originPid = origin.pid
  if (!(await waitFor(`${ORIGIN}/__stats`, 20_000))) throw new Error('fake origin did not start')

  // The fence canary: a loopback port REST may never reach. It only counts connections.
  const canaryListener = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: {
      open(socket) {
        canary.accepted += 1
        socket.end()
      },
      data() {}
    }
  })
  canary.port = canaryListener.port
  // An open listener keeps the runner alive after the footer; cleanup closes it.
  canary.stop = () => canaryListener.stop(true)
  restLogPath = join(outDir, 'logs', `${scenario}-${session}.rest.log`)
  const entry = layer === 2 ? join(BENCH_DIR, 'layer2.ts') : 'src/index.ts'
  const bunCmd = [process.execPath, '--preload', join(BENCH_DIR, 'shim.ts'), entry]
  const env = restEnv(rateLimitMax, canary.port)
  const rest = spawnChild(['sandbox-exec', '-p', FENCE_PROFILE, ...bunCmd], {
    cwd: SERVER_DIR,
    env,
    stdout: Bun.file(restLogPath),
    stderr: Bun.file(`${restLogPath}.stderr`)
  })
  if (!(await waitFor(`${REST}/health/live`, 30_000)) || !(await waitFor(`${SIDE}/stats`, 5000)))
    throw new Error(`REST did not start; see ${restLogPath}`)
  const restComm = (await run(['ps', '-o', 'comm=', '-p', String(rest.pid)], 3000)).out
  // Every session proves its own REST is fenced before any load (M2).
  const sessionFence = await fenceCheck()
  if (!sessionFence.pass)
    throw new Error(`fence check failed, no load sent: ${JSON.stringify(sessionFence)}`)

  // Session-long samplers: foreign peers and blocked fetches count outside the windows too.
  sampler.start(rest.pid, () => [currentDriverPid, originPid])
  await sleep(2000)
  const idle0 = await getJson(`${SIDE}/stats`)
  await sleep(smoke ? 3000 : 5000)
  const idle1 = await getJson(`${SIDE}/stats`)
  idleCpuUsPerS =
    (idle1.cpuUserUs + idle1.cpuSystemUs - idle0.cpuUserUs - idle0.cpuSystemUs) /
    ((idle1.at - idle0.at) / 1000)

  write({
    type: 'session',
    scenario,
    session,
    smoke,
    layer,
    variant: layer === 2 ? variant : undefined,
    order,
    startedAt: new Date().toISOString(),
    machine: {
      cpu: cpus()[0]?.model,
      cores: cpus().length,
      memoryGiB: Math.round(totalmem() / 2 ** 30),
      os: `${platform()} ${release()}`
    },
    facts: startFacts,
    redis: {
      backend: redisBackend,
      ...redis,
      container: redisBackend === 'docker' ? REDIS_CONTAINER : undefined
    },
    rest: {
      pid: rest.pid,
      comm: restComm,
      entry,
      fence: FENCE_PROFILE,
      fenceCheck: sessionFence,
      conn,
      transport: TRANSPORT,
      env: Object.fromEntries(Object.entries(env).filter(([k]) => k !== 'PATH' && k !== 'HOME')),
      fetchConcurrencyCap: 'BUN_CONFIG_MAX_HTTP_REQUESTS unset: Bun default 256, as in production',
      redisCommandTimeoutMs: 60000,
      idle: {
        cpuPct: round(idleCpuUsPerS / 1e4, 2),
        rssMiB: round(idle1.rss / 2 ** 20, 1),
        heapMiB: round(idle1.heapUsed / 2 ** 20, 1)
      }
    },
    driver: { fetchConcurrencyCap: 16384, timeoutMs: DRIVER_TIMEOUT_MS, ipForRamps: rampIp },
    plan: { budgetS, steps: plan.steps.map((st) => st.label) },
    kneeRule: KNEE_RULE
  })
  own.headerWritten = true
  console.log(
    `session ${session} ${scenario}${smoke ? ' (smoke)' : ''}: REST pid ${rest.pid} (${restComm}), redis ${redisBackend}, log ${restLogPath}`
  )

  const allowForeign = new Set<string>()
  let probeFailures = 0
  let expectedBlocked = 0
  if (scenario === 'lag-probe') probeFailures += await runLagProbe(write)
  if (scenario === 'step0') {
    probeFailures += await runStep0(write, allowForeign)
    expectedBlocked = 1
  }

  await plan.prepare?.(session)
  const steps: any[] = []
  const skipped: string[] = []
  for (const [i, spec] of plan.steps.entries()) {
    const prev = steps.filter((s) => s.series === spec.series && !s.prime).at(-1)
    if (spec.control) await sleep(CONTROL_REST_S * 1000)
    // Past total collapse a higher step only burns the session budget. A control always runs.
    const bad = prev
      ? (prev.client.errorRate ?? 0) +
        (prev.client.timeoutRate ?? 0) +
        (prev.client.server5xxRate ?? 0)
      : 0
    if (
      !spec.control &&
      prev &&
      (bad > 50 || (prev.offeredRate && prev.client.throughputRate < 0.5 * prev.offeredRate))
    ) {
      skipped.push(spec.label)
      continue
    }
    const cfg: DriverConfig = {
      base: REST,
      timeoutMs: DRIVER_TIMEOUT_MS,
      ip: 'none',
      run: `${session}-${i}`,
      seed: `${scenario}-${spec.label}`,
      recordsPath: join(outDir, 'steps', `${session}-${i}.requests.csv.gz`),
      ...spec.driver
    }
    const result = await runDriverStep(cfg, spec.actions)
    const step = summarizeStep(spec, result, plan, i)
    steps.push(step)
    write(step)
    const c = step.client
    console.log(
      `${spec.label}: thr ${c.throughputRate}/s p50 ${c.latencyMs?.p50} p99 ${c.latencyMs?.p99} ms err ${c.errorRate}% to ${c.timeoutRate}% cpu ${step.rest.cpuPct}% rss ${step.rest.rssMaxMiB} lagMax ${step.rest.lagMs?.max} inflight ${step.rest.outboundInflightMax} ${step.valid ? '' : `VOID ${step.voidReasons.join('; ')}`}`
    )
    await sleep(1000)
  }

  const endFence = await fenceCheck()
  await sampler.stop()
  const sideEnd = await getJson(`${SIDE}/stats`, 3000)
  const endFacts = await sessionFacts()
  const voidReasons = compareFacts(startFacts, endFacts)
  if (!endFence.pass)
    voidReasons.push(`fence check failed at session end: ${JSON.stringify(endFence)}`)
  if (!sideEnd) voidReasons.push('side port unread at session end')
  else if (sideEnd.blocked !== expectedBlocked)
    voidReasons.push(
      `shim blocked ${sideEnd.blocked} fetches over the session (expected ${expectedBlocked}): ${JSON.stringify(sideEnd.blockedHosts)}`
    )
  const foreign = [...new Set(sampler.foreign.map((f) => f.peer))].filter(
    (p) => !allowForeign.has(p)
  )
  if (foreign.length > 0) voidReasons.push(`foreign peers over the session: ${foreign.join(' ')}`)
  if (probeFailures > 0) voidReasons.push(`${probeFailures} probe(s) failed`)
  const restLogText = await Bun.file(restLogPath)
    .text()
    .catch(() => '')
  const series = [...new Set(steps.map((s) => s.series))]
  const knees =
    order === 'reverse'
      ? 'order reverse: compare rates across sessions with replay.ts, not a knee'
      : Object.fromEntries(
          series.map((name) => [
            name,
            seriesKnees(
              name,
              steps.filter((s) => s.series === name)
            )
          ])
        )
  const controls = Object.fromEntries(
    series.flatMap((name) => {
      const first = steps.find((s) => s.series === name && !s.control && !s.prime)
      const control = steps.find((s) => s.series === name && s.control)
      return first && control ? [[name, pairSummary(first, control)]] : []
    })
  )
  const ramp = steps.filter((s) => !s.prime)
  write({
    type: 'footer',
    session,
    endedAt: new Date().toISOString(),
    valid: voidReasons.length === 0,
    voidReasons,
    facts: endFacts,
    fenceCheckEnd: endFence,
    shim: sideEnd
      ? { blocked: sideEnd.blocked, blockedHosts: sideEnd.blockedHosts, rewrites: sideEnd.rewrites }
      : null,
    foreignPeersSession: [...new Set(sampler.foreign.map((f) => f.peer))],
    knees,
    skipped,
    voidSteps: steps.filter((s) => !s.valid).map((s) => `${s.label}: ${s.voidReasons.join('; ')}`),
    aa: scenario === 'aa' && ramp.length >= 2 ? pairSummary(ramp[0], ramp[1]) : undefined,
    controls,
    restLog: {
      errorLines: (restLogText.match(/"level":50/g) ?? []).length,
      redisErrors: (restLogText.match(REDIS_LOG_ERROR) ?? []).length
    }
  })
  own.footerWritten = true
  console.log(JSON.stringify({ knees, valid: voidReasons.length === 0, voidReasons, skipped }))
}

try {
  await main()
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  if (sampler.running) await sampler.stop().catch(() => {})
  await cleanup(process.exitCode ? 'error' : 'end')
}
