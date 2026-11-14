/**
 * Bench preload: `bun --preload <this> src/index.ts`. Not product code.
 * Rewrites fetches to 203.0.113.0/24 (TEST-NET-3) onto the fake origin and blocks every other
 * fetch. The sandbox fence (run.ts) is the network guard; this shim only routes and counts. A side port reports the counters,
 * the event-loop lag and the process CPU, and can block the loop on purpose (lag probe proof).
 */
const BENCH_HOST = /^203\.0\.113\.(\d{1,3})$/
const ORIGIN = process.env.BENCH_ORIGIN_URL ?? 'http://127.0.0.1:4621'
const SIDE_PORT = Number(process.env.BENCH_SIDE_PORT ?? 4622)
// `fresh`: one new TCP connection per fetch (keepalive false), as a new host costs in production.
const CONN = process.env.BENCH_CONN === 'fresh' ? 'fresh' : 'pooled'
// The runner's canary listener: the only loopback port besides 4622 the probe may dial.
const CANARY_PORT = Number(process.env.BENCH_CANARY_PORT ?? 0)
const LAG_TICK_MS = 5
// The tick reads a block up to 5 ms low, so a drift of 45 ms is a block of 50 ms or more.
const STALL_DRIFT_MS = 45
// Timer jitter adds about 1 ms per 5 ms tick; only drift of 10 ms or more counts as stalled time.
const STALLED_DRIFT_MS = 10

const realFetch = globalThis.fetch

const counters = {
  rewrites: 0,
  blocked: 0,
  blockedHosts: {} as Record<string, number>,
  fetchErrors: 0,
  fetchErrorCodes: {} as Record<string, number>,
  inflight: 0,
  inflightMax: 0
}

const block = (host: string): never => {
  counters.blocked += 1
  counters.blockedHosts[host] = (counters.blockedHosts[host] ?? 0) + 1
  throw new TypeError(`bench shim: outbound fetch to ${host} blocked`)
}

const benchFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const original = input instanceof Request ? input.url : String(input)
  let url: URL
  try {
    url = new URL(original)
  } catch {
    return block('unparsable')
  }
  // Port 80 only: the icon route refuses an origin that names a port.
  if (url.protocol !== 'http:' || url.port !== '' || !BENCH_HOST.test(url.hostname)) {
    return block(url.host || 'unknown')
  }
  // A followed redirect would leave the fence inside realFetch. safeFetch asks for
  // 'manual'; any other caller is refused and counted, so the step is void.
  const redirect = init?.redirect ?? (input instanceof Request ? input.redirect : 'follow')
  if (redirect !== 'manual') return block(`redirect-${redirect}:${url.hostname}`)
  // Bun's `proxy` and `unix` options would dial past the rewrite; product code sets neither.
  const extra = init as { proxy?: unknown; unix?: unknown } | undefined
  if (extra?.proxy !== undefined) return block(`proxy:${url.hostname}`)
  if (extra?.unix !== undefined) return block(`unix:${url.hostname}`)
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  )
  headers.set('x-bench-host', url.hostname)
  const target = `${ORIGIN}${url.pathname}${url.search}`
  counters.rewrites += 1
  counters.inflight += 1
  if (counters.inflight > counters.inflightMax) counters.inflightMax = counters.inflight
  try {
    const response = await realFetch(
      input instanceof Request ? new Request(target, input) : target,
      { ...init, headers, redirect: 'manual', ...(CONN === 'fresh' ? { keepalive: false } : {}) }
    )
    // htmlScrape builds card.url from response.url, so the bench host must survive.
    Object.defineProperty(response, 'url', { value: original, configurable: true })
    return response
  } catch (err) {
    counters.fetchErrors += 1
    // EADDRNOTAVAIL here means the bench ran out of ports (fresh arm): a harness fault, not REST.
    const code =
      (err as { code?: string; name?: string })?.code ?? (err as Error)?.name ?? 'unknown'
    counters.fetchErrorCodes[code] = (counters.fetchErrorCodes[code] ?? 0) + 1
    throw err
  } finally {
    counters.inflight -= 1
  }
}
// No copy of the real fetch's own methods: preconnect would dial without the fence.
globalThis.fetch = Object.assign(benchFetch, {
  preconnect: () => block('preconnect')
}) as unknown as typeof fetch

// Bun.fetch is read-only in Bun 1.4.4 and cannot be wrapped; the sandbox fence covers it.
// REST and layer 2 bind 0.0.0.0; the bench keeps every listener on loopback.
const realServe = Bun.serve
;(Bun as { serve: typeof Bun.serve }).serve = ((options: Parameters<typeof Bun.serve>[0]) =>
  realServe({ ...options, hostname: '127.0.0.1' } as Parameters<
    typeof Bun.serve
  >[0])) as typeof Bun.serve

// Timer drift: perf_hooks.monitorEventLoopDelay in Bun 1.4.4 missed a 50 ms block (STEP 0).
// Ticks weight by count, not time, so a stall also counts by itself and by its drift sum.
let lagWindow: number[] = []
let lagMaxEver = 0
let stalls = 0
let driftSum = 0
let windowStartedAt = performance.now()
let lastTick = performance.now()
setInterval(() => {
  const now = performance.now()
  const drift = Math.max(0, now - lastTick - LAG_TICK_MS)
  lastTick = now
  lagWindow.push(drift)
  if (drift >= STALLED_DRIFT_MS) driftSum += drift
  if (drift >= STALL_DRIFT_MS) stalls += 1
  if (drift > lagMaxEver) lagMaxEver = drift
}, LAG_TICK_MS)

const quantile = (sorted: number[], q: number): number =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

const snapshot = (reset: boolean) => {
  const lag = [...lagWindow].sort((a, b) => a - b)
  const cpu = process.cpuUsage()
  const mem = process.memoryUsage()
  const windowMs = performance.now() - windowStartedAt
  const body = {
    pid: process.pid,
    conn: CONN,
    at: Date.now(),
    cpuUserUs: cpu.user,
    cpuSystemUs: cpu.system,
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    ...counters,
    lag: {
      n: lag.length,
      p50: quantile(lag, 0.5),
      p99: quantile(lag, 0.99),
      max: lag.at(-1) ?? 0,
      maxEver: lagMaxEver,
      // Ticks that drifted 50 ms or more: the Rust trigger names blocks, not a quantile.
      stalls,
      // Share of wall time in stalls of 10 ms or more: the time-weighted view p99 cannot give.
      stalledFraction: windowMs > 0 ? driftSum / windowMs : 0,
      windowMs
    }
  }
  if (reset) {
    lagWindow = []
    stalls = 0
    driftSum = 0
    windowStartedAt = performance.now()
    counters.inflightMax = counters.inflight
  }
  return body
}

/** Positive controls for the fences, run from inside the REST process. */
const connectProbe = (hostname: string, port: number, holdMs: number) =>
  new Promise<{ outcome: string; ms: number }>((resolve) => {
    const start = performance.now()
    const done = (outcome: string) =>
      resolve({ outcome, ms: Math.round(performance.now() - start) })
    const timer = setTimeout(() => done('timeout'), 1500)
    Bun.connect({
      hostname,
      port,
      socket: {
        data() {},
        open(socket) {
          clearTimeout(timer)
          setTimeout(() => socket.end(), holdMs)
          done('open')
        },
        connectError(_socket, err) {
          clearTimeout(timer)
          done(`error:${(err as { code?: string }).code ?? 'unknown'}`)
        }
      }
    }).catch((err: { code?: string }) => {
      clearTimeout(timer)
      done(`error:${err?.code ?? 'unknown'}`)
    })
  })

realServe({
  port: SIDE_PORT,
  hostname: '127.0.0.1',
  fetch: async (req) => {
    const url = new URL(req.url)
    if (url.pathname === '/stats') return Response.json(snapshot(url.searchParams.has('reset')))
    if (url.pathname === '/sabotage') {
      // A known synchronous block, so a run can prove the lag probe reports it.
      const ms = Number(url.searchParams.get('ms') ?? 50)
      const start = performance.now()
      while (performance.now() - start < ms) {
        /* spin */
      }
      return Response.json({ blockedMs: performance.now() - start })
    }
    if (url.pathname === '/connect-probe') {
      // Loopback only, and only two ports: the runner's canary (the fence must refuse it) and
      // this side port (allowed, so the foreign-peer sampler must flag it). Nothing else.
      const port = Number(url.searchParams.get('port'))
      if (port !== SIDE_PORT && !(CANARY_PORT > 0 && port === CANARY_PORT))
        return new Response('no', { status: 400 })
      return Response.json(
        await connectProbe('127.0.0.1', port, Number(url.searchParams.get('hold') ?? 0))
      )
    }
    return new Response('not found', { status: 404 })
  }
})

// Exit when the runner dies, so a killed runner never leaves REST on 4620. sandbox-exec
// execs in place, so the runner is the parent; a reused pid cannot keep ppid equal to it.
const parent = Number(process.env.BENCH_PARENT_PID ?? 0)
if (parent) {
  setInterval(() => {
    if (process.ppid !== parent) process.exit(3)
  }, 1000).unref()
}
