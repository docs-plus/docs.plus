/**
 * Load driver for the link-scraper tolerance bench. Not product code; run.ts spawns it per step.
 * Usage: bun driver.ts <config.json>. Prints `window-start` / `window-end` lines, then one result.
 * Open loop measures latency from the intended send time, so a slow server cannot slow the
 * offered rate (no coordinated omission). Closed loop and burst modes serve the ramps and the herd.
 */
import { readFileSync, writeFileSync } from 'node:fs'

export interface Lane {
  name: string
  weight?: number
  /** Request path on `base`, e.g. `/api/metadata`. Tokens below are substituted. */
  route: string
  /** Query parameter that carries `target`, URL-encoded. */
  param?: string
  /** Tokens: {run} {seq} {round} {host} (203.0.113.10-250) and {k:N} (0..N-1). */
  target?: string
  base?: string
  headers?: Record<string, string>
  /** A full answer: anything else that came back counts as degraded (a 204, a cut body, a fallback card). */
  /** `designedStatus`: a status that is the designed answer (a limiter 429), never degraded. */
  expect?: { status?: number; bytes?: number; noFallback?: boolean; designedStatus?: number[] }
}

export interface DriverConfig {
  base: string
  mode: 'open' | 'closed' | 'burst'
  rate?: number
  concurrency?: number
  burst?: { size: number; rounds: number; gapMs?: number }
  durationS: number
  warmupS: number
  timeoutMs: number
  /** `pool` cycles 64 addresses, as a small set of real clients behind Traefik would. */
  ip: 'none' | 'fixed' | 'pool' | 'many'
  lanes: Lane[]
  run: string
  /** Seeds every random choice, so a repeat gets the same workload. */
  seed?: string
  /** Gzipped CSV of every request, so repeats can be pooled and quantiles rebuilt later. */
  recordsPath?: string
}

interface Rec {
  lane: string
  intended: number
  sent: number
  end: number
  status: number
  err: string | null
  cached: boolean | null
  fallback: boolean
  miss: string | null
  leak: boolean
  bytes: number
  degraded: boolean
}

const quantile = (sorted: number[], q: number): number =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
const round = (n: number) => Math.round(n * 100) / 100

// mulberry32: small and fast; the seed comes from the run id.
const rng = (seed: string) => {
  let a = 0
  for (let i = 0; i < seed.length; i++)
    a = (Math.imul(a ^ seed.charCodeAt(i), 2654435761) >>> 0) + 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const errKind = (err: unknown): string => {
  const e = err as { name?: string; code?: string; message?: string }
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'timeout'
  const code = e?.code ?? ''
  if (code === 'ConnectionRefused' || code === 'ECONNREFUSED') return 'refused'
  if (code === 'ECONNRESET' || code === 'ConnectionClosed') return 'reset'
  // Harness faults, never a REST knee: out of ports or file handles on this machine.
  if (code === 'EADDRNOTAVAIL' || code === 'EMFILE') return `harness:${code}`
  return `other:${code || e?.name || 'unknown'}`
}

const ipFor = (mode: DriverConfig['ip'], seq: number): string | null => {
  // 198.18.0.0/15 is the benchmark range (RFC 2544): a header value only, never dialled.
  if (mode === 'fixed') return '198.51.100.7'
  if (mode === 'pool') return `198.18.0.${(seq % 64) + 1}`
  if (mode === 'many') return `198.${18 + ((seq >> 16) & 1)}.${(seq >> 8) & 255}.${seq & 255}`
  return null
}

/** Smooth weighted round robin: every lane gets its exact share, in a fixed order. */
const laneCycle = (lanes: Lane[]) => {
  const current = lanes.map(() => 0)
  const total = lanes.reduce((sum, lane) => sum + (lane.weight ?? 1), 0)
  return (): Lane => {
    let best = 0
    for (let i = 0; i < lanes.length; i++) {
      current[i] += lanes[i].weight ?? 1
      if (current[i] > current[best]) best = i
    }
    current[best] -= total
    return lanes[best]
  }
}

export const runDriver = async (cfg: DriverConfig) => {
  const recs: Rec[] = []
  const pending = new Set<Promise<void>>()
  const random = rng(cfg.seed ?? cfg.run)
  const nextLane = laneCycle(cfg.lanes)
  let seq = 0

  const fill = (template: string, n: number, roundTag: string) =>
    template
      .replaceAll('{run}', cfg.run)
      .replaceAll('{seq}', String(n))
      .replaceAll('{round}', roundTag)
      .replaceAll('{host}', `203.0.113.${10 + Math.floor(random() * 241)}`)
      .replace(/\{k:(\d+)\}/g, (_, k) => String(Math.floor(random() * Number(k))))

  const buildUrl = (lane: Lane, n: number, roundTag = '') => {
    const path = fill(lane.route, n, roundTag)
    const base = lane.base ?? cfg.base
    if (!lane.param || !lane.target) return `${base}${path}`
    return `${base}${path}?${lane.param}=${encodeURIComponent(fill(lane.target, n, roundTag))}`
  }

  const fire = (lane: Lane, intended: number, roundTag = ''): Promise<void> => {
    const n = seq++
    const url = buildUrl(lane, n, roundTag)
    const headers: Record<string, string> = { 'accept-language': 'en', ...(lane.headers ?? {}) }
    const ip = ipFor(cfg.ip, n)
    if (ip) headers['x-real-ip'] = ip
    const rec: Rec = {
      lane: lane.name,
      intended,
      sent: performance.now(),
      end: 0,
      status: 0,
      err: null,
      cached: null,
      fallback: false,
      miss: null,
      leak: false,
      bytes: 0,
      degraded: false
    }
    recs.push(rec)
    const p = (async () => {
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(cfg.timeoutMs) })
        rec.status = res.status
        if ((res.headers.get('content-type') ?? '').includes('json')) {
          const text = await res.text()
          rec.bytes = text.length
          try {
            const body = JSON.parse(text)
            rec.cached = typeof body.cached === 'boolean' ? body.cached : null
            rec.fallback = body.fallback === true
            rec.miss = body.miss ?? null
            rec.leak = typeof body.url === 'string' && body.url.includes('127.0.0.1')
          } catch {
            /* not a card */
          }
        } else {
          rec.bytes = (await res.arrayBuffer()).byteLength
        }
        const e = lane.expect
        rec.degraded =
          !!e &&
          !e.designedStatus?.includes(rec.status) &&
          ((e.status !== undefined && rec.status !== e.status) ||
            (e.bytes !== undefined && rec.bytes !== e.bytes) ||
            (e.noFallback === true && rec.fallback))
      } catch (err) {
        rec.err = errKind(err)
      }
      rec.end = performance.now()
    })()
    pending.add(p)
    p.finally(() => pending.delete(p))
    return p
  }

  // The driver's own loop lag: a busy driver would add latency the server never caused.
  const driverLag: number[] = []
  let lastTick = performance.now()
  const lagTimer = setInterval(() => {
    const now = performance.now()
    driverLag.push(Math.max(0, now - lastTick - 5))
    lastTick = now
  }, 5)

  const t0 = performance.now()
  const windowStart = t0 + cfg.warmupS * 1000
  const windowEnd = windowStart + cfg.durationS * 1000
  const say = (event: string) => console.log(JSON.stringify({ event, at: Date.now() }))

  if (cfg.mode === 'open') {
    const rate = cfg.rate ?? 1
    let sent = 0
    let announced = false
    while (performance.now() < windowEnd) {
      const now = performance.now()
      if (!announced && now >= windowStart) {
        say('window-start')
        announced = true
      }
      // +1: request k is due once now reaches its intended time t0 + k/rate.
      const due = Math.floor(((now - t0) * rate) / 1000) + 1
      while (sent < due) {
        const intended = t0 + (sent * 1000) / rate
        if (intended >= windowEnd) break
        fire(nextLane(), intended)
        sent += 1
      }
      // On a quiet Mac, timer coalescing stretched Bun.sleep(1) to a 5.6 ms send-lag p99. Sleep
      // until 2 ms before the next send, then yield through setImmediate, which still runs I/O.
      const wait = t0 + (sent * 1000) / rate - performance.now()
      if (wait > 2) await Bun.sleep(wait - 2)
      else await new Promise((resolve) => setImmediate(resolve))
    }
  } else if (cfg.mode === 'closed') {
    let announced = false
    const worker = async () => {
      while (performance.now() < windowEnd) {
        if (!announced && performance.now() >= windowStart) {
          say('window-start')
          announced = true
        }
        await fire(nextLane(), performance.now())
      }
    }
    await Promise.all(Array.from({ length: cfg.concurrency ?? 1 }, worker))
  } else {
    const { size, rounds, gapMs = 50 } = cfg.burst ?? { size: 10, rounds: 1 }
    say('window-start')
    for (let r = 0; r < rounds; r++) {
      const now = performance.now()
      await Promise.all(
        Array.from({ length: size }, () => fire(cfg.lanes[0], now, `${cfg.run}-r${r}`))
      )
      await Bun.sleep(gapMs)
    }
  }
  const windowEndActual = performance.now()
  say('window-end')
  await Promise.all([...pending])
  clearInterval(lagTimer)
  const windowStartEpochMs = Math.round(Date.now() - (performance.now() - windowStart))

  if (cfg.recordsPath) writeRecords(cfg.recordsPath, recs, windowStart, windowEnd)

  const inWindow =
    cfg.mode === 'burst'
      ? recs
      : recs.filter((r) => r.intended >= windowStart && r.intended < windowEnd)
  const windowS = cfg.mode === 'burst' ? (windowEndActual - t0) / 1000 : cfg.durationS
  // Throughput: answers that finished inside the window shifted by the p50 latency, whatever
  // their send time. A steady server finishes as many as it is offered; a queueing one fewer.
  // Without the shift a latency longer than the warm-up read as lost capacity.
  const completedIn = (rs: Rec[]) => {
    if (cfg.mode === 'burst')
      return rs.filter((r) => r.err === null && r.end >= t0 && r.end < windowEndActual)
    const own = rs
      .filter((r) => r.err === null && r.intended >= windowStart && r.intended < windowEnd)
      .map((r) => r.end - r.intended)
      .sort((a, b) => a - b)
    const shift = quantile(own, 0.5)
    return rs.filter(
      (r) => r.err === null && r.end >= windowStart + shift && r.end < windowEnd + shift
    )
  }
  const completed = completedIn(recs)
  const good = (r: Rec) => r.status < 400 && r.status !== 0 && !r.degraded
  const lagSorted = [...driverLag].sort((a, b) => a - b)
  return {
    ...summarize(inWindow, windowS, cfg),
    windowStartEpochMs,
    completedInWindow: completed.length,
    throughputRate: round(completed.length / windowS),
    goodputRate: round(completed.filter(good).length / windowS),
    sentTotal: seq,
    driverLoopLagMs: {
      p99: round(quantile(lagSorted, 0.99)),
      max: round(lagSorted.at(-1) ?? 0)
    },
    lanes: (() => {
      const lanes = byLane(inWindow, windowS, cfg)
      // Each lane's own throughput, shifted by its own p50, so a lane that holds by design
      // cannot hide a stalled one.
      for (const [name, lane] of Object.entries(lanes ?? {})) {
        const done = completedIn(recs.filter((r) => r.lane === name))
        ;(lane as Record<string, unknown>).throughputRate = round(done.length / windowS)
        ;(lane as Record<string, unknown>).goodputRate = round(done.filter(good).length / windowS)
      }
      return lanes
    })()
  }
}

/** One line per request: lane, intended offset from the window start, latency, outcome. */
const writeRecords = (path: string, recs: Rec[], windowStart: number, windowEnd: number) => {
  const lines = [
    'lane,intendedMs,sendLagMs,latencyMs,status,err,cached,miss,inWindow,bytes,fallback,degraded,leak'
  ]
  for (const r of recs) {
    lines.push(
      [
        r.lane,
        round(r.intended - windowStart),
        round(r.sent - r.intended),
        round(r.end - r.intended),
        r.status,
        r.err ?? '',
        r.cached === null ? '' : r.cached ? 1 : 0,
        r.miss ?? '',
        r.intended >= windowStart && r.intended < windowEnd ? 1 : 0,
        r.bytes,
        r.fallback ? 1 : 0,
        r.degraded ? 1 : 0,
        r.leak ? 1 : 0
      ].join(',')
    )
  }
  writeFileSync(path, Bun.gzipSync(new TextEncoder().encode(`${lines.join('\n')}\n`)))
}

const summarize = (recs: Rec[], windowS: number, cfg: DriverConfig) => {
  const answered = recs.filter((r) => r.err === null)
  const lat = answered.map((r) => r.end - r.intended).sort((a, b) => a - b)
  const service = answered.map((r) => r.end - r.sent).sort((a, b) => a - b)
  const sendLag = recs.map((r) => r.sent - r.intended).sort((a, b) => a - b)
  const status: Record<string, number> = {}
  const errors: Record<string, number> = {}
  for (const r of recs) {
    if (r.err) errors[r.err] = (errors[r.err] ?? 0) + 1
    else status[r.status] = (status[r.status] ?? 0) + 1
  }
  const timeouts = errors.timeout ?? 0
  const otherErrors = recs.length - answered.length - timeouts
  const misses: Record<string, number> = {}
  for (const r of answered) if (r.miss) misses[r.miss] = (misses[r.miss] ?? 0) + 1
  // An empty lane reports nulls, not a 0 ms latency nobody measured.
  if (recs.length === 0) return { requests: 0, answered: 0, latencyMs: null, timeline: [] }
  const tl = timeline(recs)
  const p99s = tl
    .filter((b) => b.n > 0)
    .map((b) => b.p99)
    .sort((a, b) => a - b)
  return {
    offeredRate: cfg.mode === 'open' ? (cfg.rate ?? 0) : null,
    requests: recs.length,
    answered: answered.length,
    // Answers by send time over the window: equals offered while answers keep coming back.
    // It is not throughput; read `throughputRate`.
    answeredPerS: round(answered.length / windowS),
    latencyMs: {
      p50: round(quantile(lat, 0.5)),
      p95: round(quantile(lat, 0.95)),
      p99: round(quantile(lat, 0.99)),
      max: round(lat.at(-1) ?? 0)
    },
    // From the actual send: what the server added, without the driver's own send lag.
    serviceMs: { p50: round(quantile(service, 0.5)), p99: round(quantile(service, 0.99)) },
    // The spread of the per-second p99, so one noisy second shows as noise.
    perSecondP99: p99s.length
      ? { min: p99s[0], median: quantile(p99s, 0.5), max: p99s.at(-1) }
      : null,
    // Queue growth: ms of p50 added per second inside the step.
    p50SlopeMsPerS: round(slope(tl.map((b) => ({ t: b.s, v: b.p50 })))),
    status,
    errors,
    timeoutRate: round((100 * timeouts) / recs.length),
    errorRate: round((100 * otherErrors) / recs.length),
    // HTTP 5xx count toward the knee: a server that answers 500 under load has failed.
    server5xxRate: round((100 * answered.filter((r) => r.status >= 500).length) / recs.length),
    rate429: round((100 * answered.filter((r) => r.status === 429).length) / recs.length),
    non2xxRate: answered.length
      ? round((100 * answered.filter((r) => r.status >= 300).length) / answered.length)
      : 0,
    cached: {
      true: answered.filter((r) => r.cached === true).length,
      false: answered.filter((r) => r.cached === false).length
    },
    fallback: answered.filter((r) => r.fallback).length,
    // Answers that are not the full answer the lane expects, in % of requests: a knee condition.
    degraded: answered.filter((r) => r.degraded).length,
    degradedRate: round((100 * answered.filter((r) => r.degraded).length) / recs.length),
    misses,
    cardUrlLeaks: answered.filter((r) => r.leak).length,
    bytesMax: answered.reduce((max, r) => Math.max(max, r.bytes), 0),
    driverSendLagMs: {
      p50: round(quantile(sendLag, 0.5)),
      p99: round(quantile(sendLag, 0.99)),
      max: round(sendLag.at(-1) ?? 0)
    },
    timeline: tl
  }
}

const slope = (pts: { t: number; v: number }[]) => {
  if (pts.length < 2) return 0
  const n = pts.length
  const mt = pts.reduce((s, p) => s + p.t, 0) / n
  const mv = pts.reduce((s, p) => s + p.v, 0) / n
  const num = pts.reduce((s, p) => s + (p.t - mt) * (p.v - mv), 0)
  const den = pts.reduce((s, p) => s + (p.t - mt) ** 2, 0)
  return den === 0 ? 0 : num / den
}

// Per-second buckets by intended send time: the A/A sigma and the Redis stall read these.
const timeline = (recs: Rec[]) => {
  if (recs.length === 0) return []
  const start = recs.reduce((min, r) => Math.min(min, r.intended), Infinity)
  const buckets = new Map<number, Rec[]>()
  for (const r of recs) {
    const s = Math.floor((r.intended - start) / 1000)
    const bucket = buckets.get(s)
    if (bucket) bucket.push(r)
    else buckets.set(s, [r])
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([s, rs]) => {
      const lat = rs
        .filter((r) => r.err === null)
        .map((r) => r.end - r.intended)
        .sort((a, b) => a - b)
      return {
        s,
        n: rs.length,
        ok: rs.filter((r) => r.err === null && r.status < 300).length,
        errors: rs.filter((r) => r.err !== null && r.err !== 'timeout').length,
        timeouts: rs.filter((r) => r.err === 'timeout').length,
        p50: round(quantile(lat, 0.5)),
        p99: round(quantile(lat, 0.99))
      }
    })
}

const byLane = (recs: Rec[], windowS: number, cfg: DriverConfig) => {
  if (cfg.lanes.length < 2) return undefined
  return Object.fromEntries(
    cfg.lanes.map((lane) => {
      const { timeline: _t, ...rest } = summarize(
        recs.filter((r) => r.lane === lane.name),
        windowS,
        cfg
      )
      return [lane.name, rest]
    })
  )
}

// Exit when the runner dies, so a killed runner never leaves a driver hammering REST.
// ppid, not kill(pid, 0): a reused pid cannot keep the parent id equal to the runner's.
const watchParent = () => {
  const parent = Number(process.env.BENCH_PARENT_PID ?? 0)
  if (!parent) return
  setInterval(() => {
    if (process.ppid !== parent) process.exit(3)
  }, 1000).unref()
}

if (import.meta.main) {
  watchParent()
  const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8')) as DriverConfig
  const result = await runDriver(cfg)
  console.log(JSON.stringify({ event: 'result', result }))
  process.exit(0)
}
