/**
 * Knee, resource, void and A/A rules for the link-scraper tolerance bench. Not product code.
 * run.ts applies them at the end of a session; replay.ts applies them again to saved JSON lines.
 * The rules are fixed in Notes/local-docs/2026-11-13-link-scraper-tolerance/raw/README.md.
 */

/** Production limit per REST replica. Compare it only with a Linux cgroup reading, never macOS RSS. */
export const PROD_MEMORY_MIB = 512
/** Below this n a p99 is close to the sample max, so the knee reads a lower quantile. */
export const MIN_N_P99 = 2000
export const MIN_N_P95 = 200
/** Control and first step further apart than this: a latency-only knee is unresolved. */
export const NOISE_BAND = 1.5
/** A/A and pair statistics use fixed blocks of this many seconds (neighbouring seconds correlate). */
export const BLOCK_S = 3
/** Other processes' CPU over a window, in % of one core. Calibration: raw/README.md, 2026-11-14. */
export const OTHER_CPU_LIMIT_PCT = 150
/** Version of the void rules below; replay re-applies them only to steps that carry `inputs`. */
export const VOID_RULES_VERSION = 4

export const KNEE_RULE =
  'Scan valid ramp steps in order and stop at the first void step. Reference = mean(first step, ' +
  'control) of the latency metric (p99 when every step has n >= 2000 in the lane, else p95 when ' +
  'n >= 200, else p50; below p99 the tail is not measured). The knee is the first step where: ' +
  'the metric is above 2x the reference on this step and the next one; or errors + timeouts + ' +
  '5xx are above 1 %; or degraded answers (not the full answer the lane expects: a 204, a cut ' +
  'body, a fallback card) are above 1 %; or throughput (answers that finished inside the window ' +
  'shifted by the p50) is below 95 % of offered and 10 or more answers short; or p50 grew inside ' +
  'the step by more than max(p50 reference, 5 ms). Closed loop: throughput gained under 10 % ' +
  'when concurrency rose. Multi-lane series name the lane the knee reads.'

type Any = any

export interface SeriesRules {
  /** Read the knee from this lane only (hang reads `fast`). */
  lane?: string
  /** Flags the scenario causes on purpose; they never count as a resource that moved. */
  designedFlags?: string[]
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const sd = (xs: number[]) => {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1))
}

// ---------- quantile tables ----------

// Student t: two-sided 95 % (0.975) and one-sided 80 % power (0.80), by degrees of freedom.
const T_TABLE: [number, number, number][] = [
  [1, 12.706, 1.376],
  [2, 4.303, 1.061],
  [3, 3.182, 0.978],
  [4, 2.776, 0.941],
  [5, 2.571, 0.92],
  [6, 2.447, 0.906],
  [7, 2.365, 0.896],
  [8, 2.306, 0.889],
  [9, 2.262, 0.883],
  [10, 2.228, 0.879],
  [12, 2.179, 0.873],
  [15, 2.131, 0.866],
  [20, 2.086, 0.86],
  [25, 2.06, 0.856],
  [30, 2.042, 0.854],
  [40, 2.021, 0.851],
  [60, 2.0, 0.848],
  [120, 1.98, 0.845]
]
/** The row at or below df, so a df between rows gets the wider (safer) quantile. */
export const tQuantiles = (df: number) => {
  if (!(df >= 1)) return null
  let row = T_TABLE[0]
  for (const r of T_TABLE) if (r[0] <= df) row = r
  return df > 120 ? { t975: 1.96, t80: 0.842 } : { t975: row[1], t80: row[2] }
}

// Chi-square 0.025 and 0.975 quantiles for df 1..10; Wilson-Hilferty above.
const CHI: [number, number][] = [
  [0.000982, 5.024],
  [0.0506, 7.378],
  [0.216, 9.348],
  [0.484, 11.143],
  [0.831, 12.833],
  [1.237, 14.449],
  [1.69, 16.013],
  [2.18, 17.535],
  [2.7, 19.023],
  [3.247, 20.483]
]
const chiQuantiles = (df: number): [number, number] => {
  if (df <= 10) return CHI[df - 1]
  const wh = (z: number) => df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3
  return [wh(-1.96), wh(1.96)]
}
/** 95 % CI of a standard deviation from k values (df k - 1). */
export const sdCi95 = (s: number, k: number) => {
  if (k < 2) return null
  const [lo, hi] = chiQuantiles(k - 1)
  return [round(s * Math.sqrt((k - 1) / hi)), round(s * Math.sqrt((k - 1) / lo))]
}

// ---------- resources ----------

const designedOf = (s: Any, rules: SeriesRules) =>
  new Set([...(rules.designedFlags ?? []), ...(s.designed ?? [])])

/** Saturation flags of one step, each with the second it first crossed when the series knows. */
export const resourceFlags = (s: Any, first: Any, rules: SeriesRules = {}) => {
  const out: Record<string, { value: number; atS: number | null }> = {}
  const designed = designedOf(s, rules)
  const at = (name: string) => s.resourceTimes?.[name] ?? null
  const add = (name: string, value: number) => {
    if (!designed.has(name)) out[name] = { value, atS: at(name) }
  }
  if ((s.rest?.cpuPct ?? 0) >= 85) add('cpu', s.rest.cpuPct)
  // Side memoryUsage().rss falls after a free; macOS ps RSS keeps freed pages and never does.
  // The 512 MiB arm reads only a Linux cgroup value (memory.current).
  const rss = s.rest?.rssMaxMiB ?? 0
  const firstRss = first.rest?.rssMaxMiB ?? rss
  const cg = s.rest?.cgroupMemoryMaxMiB
  if (typeof cg === 'number' && cg > 0.8 * PROD_MEMORY_MIB) add('rss', cg)
  else if (rss - firstRss > 128) add('rss', rss)
  // Bun holds a fetch slot until the body is read: headers in flight plus bodies still streaming.
  const inUse = Math.max(s.rest?.outboundInUseMax ?? 0, s.rest?.outboundInflightMax ?? 0)
  if (inUse >= 250) add('outbound-pool', inUse)
  // The settled Rust trigger names a block over 50 ms, so the flag reads the max, not p99.
  // `stalls` counts drift of 45 ms or more (a 50 ms block, given the 5 ms tick, +-5 ms).
  if ((s.rest?.lagMs?.stalls ?? 0) > 0 || (s.rest?.lagMs?.max ?? 0) > 50)
    add('lag', s.rest.lagMs.max)
  if ((s.redis?.infoTimeouts ?? 0) > 0) add('redis-stall', s.redis.infoTimeouts)
  if ((s.client?.status?.['429'] ?? 0) > 0) add('limiter-429', s.client.status['429'])
  const unreachable = s.client?.misses?.unreachable ?? 0
  if (s.client?.answered && unreachable / s.client.answered > 0.01)
    add('upstream-timeouts', unreachable)
  return out
}

const view = (s: Any, lane?: string) => (lane ? s.client?.lanes?.[lane] : s.client)

export const kneeOf = (series: Any[], rules: SeriesRules = {}) => {
  const ramp = series.filter((s) => !s.control && !s.prime)
  const scanned: Any[] = []
  let truncatedAt: string | null = null
  for (const s of ramp) {
    if (!s.valid) {
      truncatedAt = s.label
      break
    }
    scanned.push(s)
  }
  if (scanned.length === 0)
    return { status: 'no-valid-steps', truncatedAt, lane: rules.lane ?? null }

  const closed = scanned[0].mode === 'closed'
  const control = series.find((s) => s.control && s.valid) ?? null
  const minN = Math.min(...scanned.map((s) => view(s, rules.lane)?.requests ?? 0))
  const metric = minN >= MIN_N_P99 ? 'p99' : minN >= MIN_N_P95 ? 'p95' : 'p50'
  const latOf = (s: Any, m: string) => view(s, rules.lane)?.latencyMs?.[m] ?? null
  const lat = (s: Any) => latOf(s, metric)
  // Mean, not min: the minimum of two noisy values sits low and makes a 2x knee too easy.
  const refOf = (m: string) => {
    const f = latOf(scanned[0], m) ?? 0
    const c = control ? latOf(control, m) : null
    return c !== null ? (f + c) / 2 : f
  }
  const firstV = lat(scanned[0]) ?? 0
  const controlV = control ? lat(control) : null
  const reference = round(refOf(metric))
  const p50Reference = round(refOf('p50'))
  const referenceDrift =
    controlV !== null && Math.min(firstV, controlV) > 0
      ? round(Math.max(firstV, controlV) / Math.min(firstV, controlV))
      : null

  const conditionsOf = (s: Any, i: number) => {
    const out: { kind: string; text: string }[] = []
    const v = view(s, rules.lane) ?? {}
    const bad = (v.errorRate ?? 0) + (v.timeoutRate ?? 0) + (v.server5xxRate ?? 0)
    if (bad > 1) {
      const kinds = Object.keys(v.errors ?? {})
      const allResets = kinds.length === 1 && kinds[0] === 'reset' && !(v.server5xxRate > 0)
      out.push({
        kind: 'errors',
        text: `errors + timeouts + 5xx ${round(bad)} % > 1 %${allResets ? ' (resets only: maybe the macOS accept queue)' : ''}`
      })
    }
    if ((v.degradedRate ?? 0) > 1)
      out.push({
        kind: 'degraded',
        text: `degraded answers ${v.degradedRate} % > 1 % (not the full answer the lane expects)`
      })
    if (closed) {
      const prev = scanned[i - 1]
      if (prev && (s.concurrency ?? 0) > (prev.concurrency ?? 0)) {
        const gain =
          (s.client.throughputRate ?? 0) / Math.max(1e-9, prev.client.throughputRate ?? 0)
        if (gain < 1.1)
          out.push({
            kind: 'plateau',
            text: `throughput ${s.client.throughputRate}/s gained ${round((gain - 1) * 100, 1)} % over c${prev.concurrency}`
          })
      }
      return out
    }
    const value = lat(s)
    if (i > 0 && value !== null && value > 2 * reference) {
      const next = scanned[i + 1]
      const nextValue = next ? lat(next) : null
      const confirmed = nextValue !== null && nextValue > 2 * reference
      out.push({
        kind: confirmed ? 'latency' : 'latency-unconfirmed',
        text: `${metric} ${value} ms > 2 x reference ${reference} ms${confirmed ? `, next step ${nextValue} ms` : next ? ', not on the next step' : ', last step'}`
      })
    }
    // Offered per lane is its in-window request count over the window. A short window loses a
    // few answers at its edges, so the deficit must also pass 10 requests.
    const t = v.throughputRate
    const offered = s.durationS ? (v.requests ?? 0) / s.durationS : 0
    const deficit = (offered - (t ?? 0)) * (s.durationS ?? 0)
    if (typeof t === 'number' && offered > 0 && t < 0.95 * offered && deficit >= 10)
      out.push({
        kind: 'throughput',
        text: `throughput ${t}/s < 95 % of offered ${round(offered)}/s (${Math.round(deficit)} answers short)`
      })
    const growth = (v.p50SlopeMsPerS ?? 0) * (s.durationS ?? 0)
    if (growth > Math.max(p50Reference, 5))
      out.push({
        kind: 'queue-growth',
        text: `p50 grew ${round(growth)} ms inside the step (> max(p50 reference ${p50Reference}, 5) ms)`
      })
    return out
  }

  let knee: Any = null
  const pending: string[] = []
  for (const [i, s] of scanned.entries()) {
    const conditions = conditionsOf(s, i)
    const firing = conditions.filter((c) => c.kind !== 'latency-unconfirmed')
    if (firing.length === 0) {
      for (const c of conditions) pending.push(`${s.label}: ${c.text}`)
      continue
    }
    const latencyOnly = firing.every((c) => c.kind === 'latency')
    knee = {
      step: s.label,
      conditions: firing.map((c) => c.text),
      resources: resourceFlags(s, scanned[0], rules),
      // A latency-only knee inside the first-vs-control noise is not a finding.
      unresolved: latencyOnly && referenceDrift !== null && referenceDrift > NOISE_BAND
    }
    break
  }

  const flagged = scanned
    .map((s) => ({ step: s.label, flags: resourceFlags(s, scanned[0], rules) }))
    .filter((x) => Object.keys(x.flags).length > 0)
  const firstFlagged = flagged[0] ?? null
  const firstMoved = firstFlagged
    ? {
        step: firstFlagged.step,
        resources: Object.entries(firstFlagged.flags)
          .sort((a, b) => (a[1].atS ?? Infinity) - (b[1].atS ?? Infinity))
          .map(([name, f]) => ({ name, value: f.value, atS: f.atS })),
        orderKnown:
          Object.keys(firstFlagged.flags).length < 2 ||
          Object.values(firstFlagged.flags).every((f) => f.atS !== null)
      }
    : null
  const best = closed ? Math.max(...scanned.map((s) => s.client?.throughputRate ?? 0)) : null
  const tail = closed || metric === 'p99' ? 'measured' : `not measured (${metric}, n ${minN})`
  // No knee is a finding only when the scan reached the last step and read the tail.
  const status = knee
    ? knee.unresolved
      ? 'unresolved'
      : 'knee'
    : truncatedAt
      ? 'truncated-no-knee'
      : tail === 'measured'
        ? 'no-knee'
        : 'tail-not-measured'

  return {
    status,
    lane: rules.lane ?? null,
    metric,
    tail,
    minN,
    reference,
    p50Reference,
    referenceFrom: controlV !== null ? 'mean(first, control)' : 'first',
    referenceDrift,
    knee,
    unconfirmed: pending,
    firstMoved,
    truncatedAt,
    stepsScanned: scanned.length,
    closedLoopBestThroughput: best
  }
}

// ---------- series fits (B7, B8) ----------

/** Least squares y = a + b x with n and R^2. */
export const linearFit = (pts: { x: number; y: number }[]) => {
  const n = pts.length
  if (n < 3) return { n, slope: null, intercept: null, r2: null }
  const mx = mean(pts.map((p) => p.x))
  const my = mean(pts.map((p) => p.y))
  const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0)
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  const syy = pts.reduce((s, p) => s + (p.y - my) ** 2, 0)
  if (sxx === 0) return { n, slope: null, intercept: null, r2: null }
  const slope = sxy / sxx
  return {
    n,
    slope,
    intercept: my - slope * mx,
    r2: syy === 0 ? null : round((sxy * sxy) / (sxx * syy), 3)
  }
}

/**
 * Across the valid steps of one series: CPU cores against completed answers per second (slope
 * = CPU seconds per answer, intercept = fixed load), and steady side RSS and heap against mean
 * work in use. One point per step, so time and GC inside a step do not pose as a slope.
 */
export const seriesFits = (steps: Any[]) => {
  const ok = steps.filter((s) => s.valid && !s.prime && s.rest?.windowS > 0)
  const cpu = linearFit(
    ok
      .filter((s) => typeof s.rest?.cpuS === 'number')
      .map((s) => ({
        x: s.client.completedInWindow / s.rest.windowS,
        y: s.rest.cpuS / s.rest.windowS
      }))
  )
  const inUse = ok.filter((s) => typeof s.rest?.inUseMean === 'number')
  const rss = linearFit(
    inUse
      .filter((s) => typeof s.rest?.rssSteadyMiB === 'number')
      .map((s) => ({ x: s.rest.inUseMean, y: s.rest.rssSteadyMiB }))
  )
  const heap = linearFit(
    inUse
      .filter((s) => typeof s.rest?.heapSteadyMiB === 'number')
      .map((s) => ({ x: s.rest.inUseMean, y: s.rest.heapSteadyMiB }))
  )
  const perAnswer = cpu.slope !== null && cpu.slope > 0 ? cpu.slope : null
  return {
    cpu: {
      ...cpu,
      cpuSPerAnswer: perAnswer === null ? null : round(perAnswer, 6),
      fixedCores: cpu.intercept === null ? null : round(cpu.intercept, 3),
      // A projection from the fit, not a measurement: production caps a replica at 1.0 CPU.
      projectedAnswersPerSAtOneCore:
        perAnswer === null || cpu.intercept === null || cpu.intercept >= 1
          ? null
          : Math.round((1 - cpu.intercept) / perAnswer),
      slope: undefined,
      intercept: undefined
    },
    rssPerInUseMiB: {
      ...rss,
      slope: rss.slope === null ? null : round(rss.slope, 4),
      intercept: rss.intercept === null ? null : round(rss.intercept, 1)
    },
    heapPerInUseMiB: {
      ...heap,
      slope: heap.slope === null ? null : round(heap.slope, 4),
      intercept: heap.intercept === null ? null : round(heap.intercept, 1)
    },
    note: 'one point per valid step; side memoryUsage().rss; in use = shim inflight + origin streaming'
  }
}

// ---------- void rules (pure, so replay can re-apply them) ----------

export const SERIES_RULES: Record<string, SeriesRules> = {
  hang: { lane: 'fast', designedFlags: ['upstream-timeouts'] }
}
export const rulesFor = (series: string): SeriesRules =>
  SERIES_RULES[series.replace(/-closed$/, '')] ?? {}

/** The lane whose latency the knee reads: the series lane, else the strictest (lowest p99). */
const kneeLaneView = (step: Any) => {
  const lane = rulesFor(step.series).lane
  if (lane) return step.client?.lanes?.[lane] ?? step.client
  const lanes = Object.values(step.client?.lanes ?? {}) as Any[]
  if (lanes.length === 0) return step.client
  return lanes
    .filter((l) => l?.latencyMs)
    .reduce((a, b) => ((b.latencyMs.p99 ?? Infinity) < (a.latencyMs.p99 ?? Infinity) ? b : a))
}

export const voidReasonsOf = (step: Any): string[] => {
  const out: string[] = []
  const v = (cond: boolean, reason: string) => {
    if (cond) out.push(reason)
  }
  const r = step.client ?? {}
  const inp = step.inputs ?? {}
  const designed = step.designed ?? []
  v(!inp.sideRead, 'side port unread (side0, side1 or sideEnd null)')
  v(step.rest?.blockedOutbound !== 0, `outbound fetch blocked (${step.rest?.blockedOutbound})`)
  v((r.cardUrlLeaks ?? 0) > 0, 'card URL leaked 127.0.0.1')
  v(
    (step.rest?.foreignPeers ?? []).length > 0,
    `foreign peer ${step.rest?.foreignPeers?.join(' ')}`
  )
  const harness = Object.entries(r.errors ?? {})
    .filter(([k]) => k.startsWith('harness:'))
    .reduce((n, [, x]) => n + (x as number), 0)
  v(harness > 0, `harness errors ${harness}`)
  // REST out of ports to the one loopback origin: a harness limit of the fresh arm, not REST.
  const portErrors = step.rest?.outboundFetchErrorCodes?.EADDRNOTAVAIL ?? 0
  v(portErrors > 0, `REST fetch EADDRNOTAVAIL ${portErrors} (bench ran out of ports)`)
  // The fresh arm exists to load ports and TIME_WAIT; an unread count leaves it blind.
  v(
    String(step.transport ?? '').startsWith('fresh') && step.rest?.timeWaitToOriginMax === null,
    `TIME_WAIT unread in the fresh arm (${(step.rest?.timeWaitReadErrors ?? []).join(', ')})`
  )
  // Limits from the lane the knee reads: a lane that holds 8 s by design must not loosen them.
  const lane = kneeLaneView(step) ?? {}
  const p99 = lane.latencyMs?.p99 ?? 0
  const sendLimit = Math.max(2, 0.1 * p99)
  const sendLag = lane.driverSendLagMs?.p99 ?? r.driverSendLagMs?.p99 ?? 0
  v(sendLag > sendLimit, `driver send lag p99 ${sendLag} ms > ${round(sendLimit)} ms (knee lane)`)
  // Timer coalescing on an idle Mac alone reads about 2 ms here, so the loop rule is looser.
  const loopLimit = Math.max(5, 0.25 * p99)
  v(
    (r.driverLoopLagMs?.p99 ?? 0) > loopLimit,
    `driver loop lag p99 ${r.driverLoopLagMs?.p99} ms > ${round(loopLimit)} ms (knee lane)`
  )
  const checks = step.plan?.checks
  if (checks === 'miss') {
    v((r.cached?.true ?? 0) !== 0, 'a miss step was served from cache')
    const m = step.origin?.match
    v(
      !(m?.hits === r.sentTotal && m?.maxPerUrl === 1),
      `origin hits do not equal sent (${m?.hits}/${r.sentTotal} max ${m?.maxPerUrl})`
    )
  }
  if (checks === 'hit') {
    v(
      !((r.cached?.false ?? 0) === 0 && (r.cached?.true ?? 0) > 0),
      'a hit step reached the scraper'
    )
    v(step.origin?.total !== 0, `hit step reached the origin (${step.origin?.total})`)
  }
  v(
    step.capacity === true && (r.status?.['429'] ?? 0) > 0,
    `limiter answered ${r.status?.['429']} x 429 in a capacity step`
  )
  v(
    step.plan?.needsCorpus === true && !String(step.origin?.headSource ?? '').startsWith('corpus:'),
    `origin head source ${step.origin?.headSource}`
  )
  v(inp.thermalChanged === true, 'thermal state changed')
  const other = step.other?.otherCpuWindow
  v(
    !other || other.meanPct > OTHER_CPU_LIMIT_PCT,
    other
      ? `other processes used ${other.meanPct} % CPU over the window (${(other.top ?? []).join(', ')})`
      : 'other-process CPU not sampled over the window'
  )
  if (!designed.includes('redis-log'))
    v(
      (step.redis?.restLogRedisErrors ?? 0) > 0,
      `REST logged ${step.redis?.restLogRedisErrors} Redis errors`
    )
  if (!designed.includes('redis-stall') && (inp.lsofSamples ?? 0) > 1)
    v(!step.redis?.restConnectionsStable, 'REST Redis sockets changed (reconnect)')
  return out
}

// ---------- A/A ----------

/** Batch means over fixed blocks of BLOCK_S seconds; under 4 blocks no SE is given. */
export const blockStats = (xs: number[]) => {
  const n = xs.length
  const blocks: number[] = []
  for (let i = 0; i + BLOCK_S <= n; i += BLOCK_S) blocks.push(mean(xs.slice(i, i + BLOCK_S)))
  const se = blocks.length >= 4 ? sd(blocks) / Math.sqrt(blocks.length) : NaN
  return { mean: mean(xs), n, blockSize: BLOCK_S, blocks: blocks.length, se }
}

/**
 * Two steps at the same rate: the gap in per-second means, its block SE, and the MDE at 80 %
 * power with t quantiles. The knee reads the pooled step p99, so this MDE is not the knee's.
 */
export const pairSummary = (a: Any, b: Any) => {
  const out: Record<string, unknown> = {}
  for (const key of ['p50', 'p99'] as const) {
    const sa = blockStats((a.client?.timeline ?? []).map((x: Any) => x[key]))
    const sb = blockStats((b.client?.timeline ?? []).map((x: Any) => x[key]))
    const blocks = Math.min(sa.blocks, sb.blocks)
    const se = Math.sqrt(sa.se ** 2 + sb.se ** 2)
    const df = sa.blocks + sb.blocks - 2
    const t = blocks >= 4 ? tQuantiles(df) : null
    const diff = sb.mean - sa.mean
    out[key] = {
      meanA: round(sa.mean),
      meanB: round(sb.mean),
      diff: round(diff),
      blockSe: Number.isFinite(se) ? round(se) : null,
      df: t ? df : null,
      mde80: t && Number.isFinite(se) ? round((t.t975 + t.t80) * se) : null,
      significant: t && Number.isFinite(se) ? Math.abs(diff) > t.t975 * se : null,
      blocks,
      note: blocks < 4 ? 'under 4 blocks: no SE, no test' : undefined
    }
  }
  out.pooledStepP99 = [a.client?.latencyMs?.p99, b.client?.latencyMs?.p99]
  out.serviceP50 = [a.client?.serviceMs?.p50, b.client?.serviceMs?.p50]
  return out
}

/** The facts a between-session comparison must share. */
export const factKeyOf = (header: Any) => ({
  benchTree: header.facts?.benchTree,
  srcTree: header.facts?.srcTree,
  bunRevision: header.facts?.bunRevision,
  bunLock: header.facts?.bunLock,
  corpus: header.facts?.corpus,
  redisBackend: header.redis?.backend,
  redisVersion: header.redis?.version,
  layer: header.layer,
  variant: header.variant ?? null,
  smoke: header.smoke,
  order: header.order,
  conn: header.rest?.conn ?? 'pooled',
  fence: header.rest?.fence,
  ip: header.driver?.ipForRamps
})

/** Between sessions: one value per valid session for each repeated step label (one fact group). */
export const betweenSessions = (bySession: Map<string, Any[]>) => {
  const byLabel = new Map<string, { session: string; p50: number; p99: number; thr: number }[]>()
  for (const [session, steps] of bySession) {
    for (const s of steps) {
      if (!s.valid || s.prime) continue
      const row = {
        session,
        p50: s.client?.latencyMs?.p50,
        p99: s.client?.latencyMs?.p99,
        thr: s.client?.throughputRate
      }
      const list = byLabel.get(s.label) ?? []
      list.push(row)
      byLabel.set(s.label, list)
    }
  }
  const out: Record<string, unknown> = {}
  for (const [label, rows] of byLabel) {
    if (rows.length < 2) continue
    const field = (k: 'p50' | 'p99' | 'thr') => {
      const xs = rows.map((r) => r[k]).filter((x) => typeof x === 'number')
      if (xs.length < 2) return null
      const s = sd(xs)
      const k2 = xs.length
      const t = tQuantiles(2 * k2 - 2)
      // MDE for a two-arm design with k sessions per arm, from the between-session SD.
      return {
        mean: round(mean(xs)),
        sd: round(s),
        sdCi95: sdCi95(s, k2),
        k: k2,
        mde80PerArmK: t ? round((t.t975 + t.t80) * s * Math.sqrt(2 / k2)) : null
      }
    }
    out[label] = {
      sessions: rows.map((r) => r.session),
      p50: field('p50'),
      p99: field('p99'),
      throughput: field('thr')
    }
  }
  return out
}

/** The headline knee plus one knee per lane; a blended multi-lane p99 is never the headline. */
export const seriesKnees = (name: string, steps: Any[]) => {
  const rules = rulesFor(name)
  const lanes = Object.keys(steps.find((s) => s.client?.lanes)?.client?.lanes ?? {})
  const perLane = Object.fromEntries(lanes.map((lane) => [lane, kneeOf(steps, { ...rules, lane })]))
  const headline = rules.lane
    ? perLane[rules.lane]
    : lanes.length > 1
      ? { status: 'per-lane', note: 'mixed lanes: read each lane, not the blended p99' }
      : kneeOf(steps, rules)
  return {
    headline,
    lanes: lanes.length > 1 ? perLane : undefined,
    pooled: lanes.length > 1 ? kneeOf(steps, { designedFlags: rules.designedFlags }) : undefined,
    fits: seriesFits(steps)
  }
}
