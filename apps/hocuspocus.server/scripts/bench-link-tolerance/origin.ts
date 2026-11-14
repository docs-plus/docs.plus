/**
 * Fake origin for the link-scraper tolerance bench (port 4621). Not product code.
 * The REST shim rewrites 203.0.113.x onto this server and names the site in `x-bench-host`.
 * The path picks the behaviour; `GET /__stats` counts hits, `?reset=1` starts a new window.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PORT = Number(process.env.BENCH_ORIGIN_PORT ?? 4621)
const CORPUS =
  process.env.BENCH_CORPUS_DIR ??
  join(import.meta.dir, '../../../../Notes/local-docs/2026-10-26-242-hovercard/bench/corpus/pages')

const enc = new TextEncoder()

// Seeded by scenario and by request seq (mulberry32), so a repeat session gets the same head
// and the same delay for the same request, whatever its session id or arrival order.
const SEED = process.env.BENCH_SEED ?? 'origin'
const hashOf = (text: string) => {
  let h = 0
  for (const ch of text) h = (Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0) + 1
  return h
}
const rngFor = (key: string) => {
  let a = hashOf(`${SEED}|${key}`)
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** The request's own number: the trailing `-<n>` of its path id, so run ids drop out. */
const seqOf = (id: string) => id.match(/-(\d+)$/)?.[1] ?? id

// Realistic heads: saved pages from the extractor bench, 20-120 KB, each with a <title>.
const loadHeads = (): { heads: Uint8Array[]; source: string } => {
  try {
    const heads = readdirSync(CORPUS)
      .filter((file) => file.endsWith('.html'))
      .map((file) => join(CORPUS, file))
      .filter((path) => {
        const size = statSync(path).size
        return size >= 20_000 && size <= 120_000
      })
      .map((path) => readFileSync(path, 'utf8'))
      .filter((html) => /<title[\s>]/i.test(html))
      .map((html) =>
        enc.encode(`${html}</head><body>${'<p>body text</p>'.repeat(200)}</body></html>`)
      )
    if (heads.length > 0) return { heads, source: `corpus:${heads.length}` }
  } catch {
    /* fall through to the synthetic head */
  }
  const meta = '<meta name="x-filler" content="lorem ipsum dolor sit amet">'.repeat(700)
  const head = `<html><head><title>Synthetic bench page</title><meta property="og:title" content="Synthetic"><meta name="description" content="A synthetic page head for the bench.">${meta}</head><body><p>x</p></body></html>`
  return { heads: [enc.encode(head)], source: 'synthetic:1' }
}
const { heads, source: headSource } = loadHeads()

const pickHead = (id: string): Uint8Array => heads[hashOf(seqOf(id)) % heads.length]

// The cap path: no `</head` or `<body` inside the first 1 MiB, as a large inline script.
const HUGE_HEAD = enc.encode(
  `<html><head><title>Huge head</title><script>var a="${'x'.repeat(2 * 1024 * 1024)}";</script></head><body></body></html>`
)
// A normal head and a 5 MiB body: the reader must stop at the head end.
const HUGE_BODY = enc.encode(
  `<html><head><title>Huge body</title></head><body>${'<p>body</p>'.repeat(480_000)}</body></html>`
)

// Copied from scripts/bench-link-extractor.ts VECTORS (not exported), near 1 MiB each.
const page = (head: string, body = '') => `<html><head>${head}</head><body>${body}</body></html>`
const ldJson = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`
const MIB = 1024 * 1024
const units = (unit: string) => Math.floor(MIB / unit.length)
const HOSTILE: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries({
    'itemprop-flood': page('<title>t</title>' + '<i itemprop>'.repeat(units('<i itemprop>'))),
    // In the head: the head cut stops at `<body`, so a body flood never reached the parser.
    'deep-nesting': page('<title>t</title>' + '<div>'.repeat(units('<div>'))),
    'no-head-end': `<html><head><title>${'"a '.repeat(units('"a '))}`,
    'entity-run': page(`<title>${'&amp;'.repeat(units('&amp;'))}</title>`),
    'jsonld-quotes': page(
      '<title>t</title>' + ldJson({ headline: '"a '.repeat(units('"a ') / 2) })
    ),
    'many-meta': page(
      '<title>t</title>' +
        '<meta name="x" content="y">'.repeat(units('<meta name="x" content="y">'))
    )
  }).map(([name, html]) => [name, enc.encode(html)])
)
const HOSTILE_VECTORS = Object.keys(HOSTILE)

// A `/jobs/` path makes htmlScrape read the body for JobPosting JSON-LD (256 KiB or 1 s).
// The load page puts the posting past 256 KiB, so every read is the full capped tail and finds
// nothing. `?near=1` puts it at 64 KiB, so a card with a `work` fact proves the pass ran.
const POSTING = ldJson({ '@type': 'JobPosting', title: 'Bench role', employmentType: 'FULL_TIME' })
const jobFiller = (bytes: number) => '<p>job text</p>'.repeat(Math.floor(bytes / 15))
const JOB_PAGE = enc.encode(page('<title>Job page</title>', jobFiller(MIB) + POSTING))
const JOB_PAGE_NEAR = enc.encode(
  page('<title>Job page</title>', jobFiller(64 * 1024) + POSTING + jobFiller(MIB))
)

// Just under the image route's 2 MiB cap (readCappedBody refuses more), with a PNG signature.
const IMAGE = new Uint8Array(2 * MIB - 4096)
IMAGE.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
// A valid ICO header (count 1) under the 32 KiB icon cap.
const ICON = new Uint8Array(1150)
ICON.set([0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 16, 16])

const html = (body: Uint8Array | string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

// Lognormal with median 250 ms and p95 near 1 s, cut at 6 s: in-flight = rate x latency.
const realDelay = (id: string): number => {
  const random = rngFor(`delay|${seqOf(id)}`)
  const u = 1 - random()
  const v = random()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.min(6000, 250 * Math.exp(0.843 * z))
}

let byKind: Record<string, number> = {}
let perUrl = new Map<string, number>()
// Not cleared by the window reset, so a run can match every request it sent, warm-up included.
let allUrls = new Map<string, number>()
let total = 0
// Drawn `dist=real` delays per window, so a run can prove the distribution it got.
let delays: number[] = []
let active = 0
let activeMax = 0
// `active` ends when the handler returns; a slow body streams on, so it has its own count.
let streaming = 0
let streamingMax = 0

const matched = (tag: string) => {
  let count = 0
  let urls = 0
  let maxPerUrl = 0
  for (const [key, hits] of allUrls) {
    if (!key.includes(tag)) continue
    count += hits
    urls += 1
    if (hits > maxPerUrl) maxPerUrl = hits
  }
  return { tag, hits: count, urls, maxPerUrl }
}

const delayStats = () => {
  if (delays.length === 0) return null
  const d = [...delays].sort((a, b) => a - b)
  const q = (p: number) => Math.round(d[Math.min(d.length - 1, Math.floor(p * d.length))])
  return { n: d.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: Math.round(d.at(-1) ?? 0) }
}

const stats = (reset: boolean) => {
  let maxPerUrl = 0
  let repeated = 0
  for (const hits of perUrl.values()) {
    if (hits > maxPerUrl) maxPerUrl = hits
    if (hits > 1) repeated += 1
  }
  const body = {
    total,
    byKind,
    distinctUrls: perUrl.size,
    maxPerUrl,
    repeatedUrls: repeated,
    active,
    activeMax,
    streaming,
    streamingMax,
    headSource,
    drawnDelayMs: delayStats()
  }
  if (reset) {
    byKind = {}
    perUrl = new Map()
    total = 0
    delays = []
    activeMax = active
    streamingMax = streaming
  }
  return body
}

const never = (req: Request) =>
  new Promise<Response>((resolve) => {
    req.signal.addEventListener('abort', () => resolve(new Response(null, { status: 499 })), {
      once: true
    })
  })

const trickle = (req: Request) => {
  let timer: ReturnType<typeof setInterval> | undefined
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode('<html><head><title>Trickle</title>'))
      timer = setInterval(() => controller.enqueue(enc.encode(' ')), 250)
      req.signal.addEventListener('abort', () => clearInterval(timer), { once: true })
    },
    cancel() {
      clearInterval(timer)
    }
  })
  return html(stream as unknown as Uint8Array)
}

// Spreads a body over `ms`, so many relays are in flight at once and their buffers add up.
const slowBody = (req: Request, body: Uint8Array, ms: number) => {
  const chunk = 64 * 1024
  const parts = Math.ceil(body.length / chunk)
  let sent = 0
  let timer: ReturnType<typeof setInterval> | undefined
  let open = true
  const end = () => {
    clearInterval(timer)
    if (open) streaming -= 1
    open = false
  }
  streaming += 1
  if (streaming > streamingMax) streamingMax = streaming
  const stream = new ReadableStream({
    start(controller) {
      timer = setInterval(() => {
        controller.enqueue(body.subarray(sent * chunk, (sent + 1) * chunk))
        sent += 1
        if (sent >= parts) {
          end()
          controller.close()
        }
      }, ms / parts)
      req.signal.addEventListener('abort', end, { once: true })
    },
    cancel() {
      end()
    }
  })
  return new Response(stream, { headers: { 'content-type': 'image/png' } })
}

const route = async (req: Request, url: URL, kind: string, parts: string[]): Promise<Response> => {
  const real = url.searchParams.get('dist') === 'real'
  const delay = real ? realDelay(parts[1] ?? '') : Number(url.searchParams.get('d') ?? 0)
  if (real) delays.push(delay)
  if (delay > 0) await Bun.sleep(delay)
  switch (kind) {
    case 'page':
      return html(pickHead(parts[1] ?? ''))
    case 'hang':
      return never(req)
    case 'trickle':
      return trickle(req)
    case 'huge':
      return html(parts[1] === 'body' ? HUGE_BODY : HUGE_HEAD)
    case 'hostile':
      return html(HOSTILE[parts[1] ?? ''] ?? HOSTILE['itemprop-flood'])
    case 'jobs':
      return html(url.searchParams.has('near') ? JOB_PAGE_NEAR : JOB_PAGE)
    case 'status':
      return html(`<html><head><title>${parts[1]}</title></head></html>`, Number(parts[1]) || 500)
    case 'redirect':
      // Absolute bench host: a 127.0.0.1 Location would fail isSafeUrl, which flags a leak.
      return new Response(null, {
        status: 302,
        headers: { location: `http://203.0.113.8/page/${parts[1] ?? 'r'}-landed` }
      })
    case 'imgpage':
      return html(
        `<html><head><title>Image page ${parts[1]}</title><meta property="og:image" content="http://203.0.113.9/img/${parts[1]}.png${url.searchParams.has('slow') ? `?slow=${url.searchParams.get('slow')}` : ''}"></head><body></body></html>`
      )
    case 'img':
      return url.searchParams.has('slow')
        ? slowBody(req, IMAGE, Number(url.searchParams.get('slow')) || 2500)
        : new Response(IMAGE, { headers: { 'content-type': 'image/png' } })
    case 'favicon.ico':
      return new Response(ICON, { headers: { 'content-type': 'image/x-icon' } })
    default:
      return new Response('not found', { status: 404 })
  }
}

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  // 0 turns the idle close off, so `hang` holds until the client aborts.
  idleTimeout: 0,
  fetch: async (req) => {
    const url = new URL(req.url)
    if (url.pathname === '/__live') {
      // Cheap counters for the 1 s sampler; /__stats walks every URL.
      return Response.json({ total, active, streaming })
    }
    if (url.pathname === '/__stats') {
      if (url.searchParams.has('resetAll')) allUrls = new Map()
      const tag = url.searchParams.get('match')
      return Response.json({
        ...stats(url.searchParams.has('reset')),
        ...(tag ? { match: matched(tag) } : {})
      })
    }
    const parts = url.pathname.split('/').filter(Boolean)
    const kind = parts[0] ?? 'root'
    total += 1
    byKind[kind] = (byKind[kind] ?? 0) + 1
    const key = `${req.headers.get('x-bench-host') ?? '-'}${url.pathname}${url.search}`
    perUrl.set(key, (perUrl.get(key) ?? 0) + 1)
    allUrls.set(key, (allUrls.get(key) ?? 0) + 1)
    active += 1
    if (active > activeMax) activeMax = active
    try {
      return await route(req, url, kind, parts)
    } finally {
      active -= 1
    }
  }
})
console.log(
  JSON.stringify({ origin: `http://127.0.0.1:${PORT}`, headSource, hostile: HOSTILE_VECTORS })
)

// Exit when the runner dies, so a killed runner never leaves the origin on 4621. A check on
// ppid, not kill(pid, 0): a reused pid cannot keep the parent id equal to the runner's.
const parent = Number(process.env.BENCH_PARENT_PID ?? 0)
if (parent) {
  setInterval(() => {
    if (process.ppid !== parent) process.exit(3)
  }, 1000).unref()
}
