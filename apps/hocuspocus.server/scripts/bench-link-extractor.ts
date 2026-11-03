/**
 * Link-metadata benchmark: fetch | run | attack | coverage | reference.
 * Not a test: timing tests are banned. BENCHMARK.md in the module has the method.
 * Usage: <mode> <dir> [iterations|rest-url] [dev|holdout|all]
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, platform, release, totalmem } from 'node:os'
import { join } from 'node:path'

import { decodeHTML } from 'entities'

import { pickIconHref } from '../src/modules/link-metadata/domain/iconLinks'
import { runHtmlScrape } from '../src/modules/link-metadata/domain/stages/htmlScrape'
import type { Scraper } from '../src/modules/link-metadata/domain/types'
import { createHeadScraper } from '../src/modules/link-metadata/infra/headScraper'

type Fields = Awaited<ReturnType<Scraper['scrape']>>
type Page = { requested: string; url: string; file: string; sha256: string; bytes: number }

// In production these hosts are answered by oEmbed or a special handler, never by the html stage.
const NOT_HTML_STAGE = ['youtube.com', 'x.com', 'github.com', 'wikipedia.org']

const ROOT = join(import.meta.dir, '../../..')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const sh = (cmd: string[]) => new TextDecoder().decode(Bun.spawnSync(cmd).stdout).trim()
const fileHash = (path: string) => {
  try {
    return sha256(readFileSync(join(ROOT, path), 'utf8')).slice(0, 16)
  } catch {
    return 'missing'
  }
}
const packageVersion = (name: string) => {
  try {
    const path = Bun.resolveSync(`${name}/package.json`, import.meta.dir)
    return JSON.parse(readFileSync(path, 'utf8')).version as string
  } catch {
    return 'missing'
  }
}

const environment = () => ({
  date: new Date().toISOString(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  bun: Bun.version,
  cpu: cpus()[0]?.model,
  cores: cpus().length,
  os: `${platform()} ${release()}`,
  memoryGb: Math.round(totalmem() / 2 ** 30),
  commit: sh(['git', '-C', ROOT, 'rev-parse', 'HEAD']),
  dirty: sh(['git', '-C', ROOT, 'status', '--porcelain']).length > 0,
  code: {
    headScraper: fileHash('apps/hocuspocus.server/src/modules/link-metadata/infra/headScraper.ts'),
    script: fileHash('apps/hocuspocus.server/scripts/bench-link-extractor.ts'),
    bunLock: fileHash('bun.lock')
  },
  versions: { entities: packageVersion('entities') }
})

// Each URL keeps the `#` heading above it, so coverage can group results by section.
const readUrls = () => {
  let section = 'none'
  const entries: { section: string; url: string }[] = []
  for (const raw of readFileSync(
    join(import.meta.dir, 'bench-link-extractor.urls.txt'),
    'utf8'
  ).split('\n')) {
    const line = raw.trim()
    if (line.startsWith('#')) section = line.slice(1).trim()
    else if (line) entries.push({ section, url: line })
  }
  return entries
}

// fetch: freezes each page head through the real html stage, with the honest User-Agent.
const fetchCorpus = async (dir: string) => {
  const urls = readUrls().map((entry) => entry.url)
  mkdirSync(join(dir, 'pages'), { recursive: true })
  const pages: Page[] = []
  const skipped: { requested: string; reason: string }[] = []

  for (const requested of urls) {
    let captured: { html: string; url: string } | undefined
    const capture: Scraper = {
      scrape: async (input) => {
        captured = input
        return { title: 'captured' }
      }
    }
    const result = await runHtmlScrape(requested, capture, 'en')
    if (!captured) {
      skipped.push({ requested, reason: typeof result === 'string' ? result : 'not-html' })
      console.log(`skip  ${requested}  ${typeof result === 'string' ? result : 'not-html'}`)
      continue
    }
    const hash = sha256(captured.html)
    const file = `${hash}.html`
    writeFileSync(join(dir, 'pages', file), captured.html)
    pages.push({
      requested,
      url: captured.url,
      file,
      sha256: hash,
      bytes: Buffer.byteLength(captured.html)
    })
    console.log(`ok    ${requested}  ${Buffer.byteLength(captured.html)} B`)
  }

  const manifest = { environment: environment(), pages, skipped }
  const manifestHash = sha256(JSON.stringify(pages.map((p) => [p.requested, p.sha256])))
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ ...manifest, manifestHash }, null, 1))
  console.log(
    `\n${pages.length} pages frozen, ${skipped.length} skipped, manifest ${manifestHash.slice(0, 12)}`
  )
}

type CorpusRow = {
  requested: string
  bytes: number
  htmlStage: boolean
  output: Fields
  medianMs: number
  p95Ms: number
}
type AttackRow = {
  vector: string
  parser: string
  targetBytes: number
  inputBytes: number
  runs: number
  medianMs: number
}

// For an even count this takes the lower middle value.
const median = (values: number[]) => {
  const sorted = [...values].sort((x, y) => x - y)
  return sorted[(sorted.length - 1) >> 1]
}
const quantile = (values: number[], q: number) => {
  const sorted = [...values].sort((x, y) => x - y)
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]
}
const ms = (ns: number) => Number((ns / 1e6).toFixed(3))
const round = (value: number, digits: number) => Number(value.toFixed(digits))

const timeOnce = async (scraper: Scraper, html: string, url: string) => {
  const start = Bun.nanoseconds()
  await scraper.scrape({ html, url })
  return Bun.nanoseconds() - start
}

// The holdout half is judged once, at the end; extractor fixes may look at the dev half only.
const inSet = (page: Page, set: string) =>
  set === 'all' || (set === 'dev') === parseInt(page.sha256[0], 16) < 8

const reachesHtmlStage = (requested: string) => {
  const host = new URL(requested).hostname
  return !NOT_HTML_STAGE.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

const summarize = (rows: CorpusRow[]) => {
  const medians = rows.map((r) => r.medianMs)
  return {
    pages: rows.length,
    p50OfPageMedians: median(medians),
    p95OfPageMedians: quantile(medians, 0.95),
    maxOfPageMedians: Math.max(...medians),
    sumOfPageMedians: round(
      medians.reduce((x, y) => x + y, 0),
      3
    )
  }
}

const runCorpus = async (dir: string, iterations: number, set: string) => {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  manifest.pages = (manifest.pages as Page[]).filter((page) => inSet(page, set))
  const scraper = createHeadScraper()
  const rows: CorpusRow[] = []

  for (const page of manifest.pages as Page[]) {
    const html = readFileSync(join(dir, 'pages', page.file), 'utf8')
    if (sha256(html) !== page.sha256) throw new Error(`corpus changed: ${page.file}`)
    const output = await scraper.scrape({ html, url: page.url })

    // Warm-up rounds, so the first timed round does not pay for the JIT.
    for (let i = 0; i < 3; i++) await timeOnce(scraper, html, page.url)
    const times: number[] = []
    for (let i = 0; i < iterations; i++) times.push(await timeOnce(scraper, html, page.url))

    rows.push({
      requested: page.requested,
      bytes: page.bytes,
      htmlStage: reachesHtmlStage(page.requested),
      output,
      medianMs: ms(median(times)),
      p95Ms: ms(quantile(times, 0.95))
    })
    console.log(`${page.requested.padEnd(64)} ${ms(median(times))} ms`)
  }

  const summary = {
    all: summarize(rows),
    htmlStageOnly: summarize(rows.filter((r) => r.htmlStage))
  }
  const result = {
    environment: environment(),
    manifestHash: manifest.manifestHash,
    set,
    iterations,
    summary,
    rows
  }
  const out = join(dir, `results-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  writeFileSync(out, JSON.stringify(result, null, 1))
  console.log(JSON.stringify(summary, null, 1))
  console.log(`\nresults: ${out}`)
}

const page = (head: string, body = '') => `<html><head>${head}</head><body>${body}</body></html>`
const ldJson = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`
// Each builder takes a unit count; `buildExact` scales it so the input lands near a byte target.
const VECTORS: Record<string, (n: number) => string> = {
  'og:title quotes': (n) => page(`<meta property="og:title" content="${'&quot;a '.repeat(n)}">`),
  '<title> quotes': (n) => page(`<title>${'"a '.repeat(n)}</title>`),
  '<title> dashes (publisher loop)': (n) => page(`<title>${'- '.repeat(n)}</title>`),
  'h1.post-title quotes': (n) => page('', `<h1 class="post-title">${'"a '.repeat(n)}</h1>`),
  'JSON-LD headline quotes': (n) => page(ldJson({ headline: '"a '.repeat(n) })),
  'description whitespace run': (n) =>
    page(`<meta name="description" content="A${' '.repeat(n)}x">`),
  'huge attribute value': (n) =>
    page(`<meta property="og:image" content="https://a.example/${'x'.repeat(n)}">`),
  'many meta tags': (n) => page('<meta name="x" content="y">'.repeat(n)),
  'bare <meta> tags': (n) => page('<meta>'.repeat(n)),
  '<meta a=b> tags': (n) => page('<meta a=b>'.repeat(n)),
  'big JSON-LD block': (n) => page(ldJson({ articleBody: 'w '.repeat(n) })),
  'deep JSON-LD nesting': (n) =>
    page(`<script type="application/ld+json">${'['.repeat(n)}${']'.repeat(n)}</script>`),
  'many JSON-LD scripts': (n) => page(ldJson({ a: 1 }).repeat(n)),
  '@graph small items': (n) =>
    page(ldJson({ '@graph': Array.from({ length: n }, () => ({ a: 1 })) })),
  '@graph outer keys x items': (n) => {
    const keys = Math.max(1, Math.ceil(Math.sqrt(n / 10)))
    const outer = Object.fromEntries(Array.from({ length: keys }, (_, i) => [`k${i}`, 1]))
    return page(ldJson({ ...outer, '@graph': Array.from({ length: keys * 10 }, () => ({})) }))
  },
  'entity run': (n) => page(`<title>${'&amp;'.repeat(n)}</title>`),
  'deep tag nesting': (n) => page('', '<div>'.repeat(n)),
  'nested article, then img': (n) =>
    page('', '<article>'.repeat(n) + '<img src="/a.png">'.repeat(n)),
  'nested .logo, then img[alt]': (n) =>
    page('', '<div class="logo">'.repeat(n) + '<img alt="x" src="/a.png">'.repeat(n)),
  'nested h1.title, then a': (n) =>
    page('', '<h1 class="title">'.repeat(n) + '<a href="/">x</a>'.repeat(n)),
  'no </head>': (n) => `<html><head><title>${'"a '.repeat(n)}`,
  'flood: bare <a>': (n) => page('', '<a>'.repeat(n)),
  'flood: <a href>': (n) => page('', '<a href>'.repeat(n)),
  'flood: <article>': (n) => page('', '<article>'.repeat(n)),
  'flood: <img src>': (n) => page('', '<img src>'.repeat(n)),
  'flood: <i itemprop>': (n) => page('', '<i itemprop>'.repeat(n)),
  'flood: <i class=logo>': (n) => page('', '<i class=logo>'.repeat(n))
}
const SIZES = [16, 64, 128, 256, 1024].map((k) => k * 1024)
// An input that took this long at one size is not run at the next, larger size.
const STOP_MS = 10_000

const buildExact = (build: (n: number) => string, target: number) => {
  let n = 64
  let html = build(n)
  for (let i = 0; i < 6; i++) {
    const bytes = Buffer.byteLength(html)
    if (Math.abs(bytes - target) <= target * 0.02) break
    n = Math.max(1, Math.round((n * target) / bytes))
    html = build(n)
  }
  return html
}

const attack = async (dir: string) => {
  const scraper = createHeadScraper()
  const rows: AttackRow[] = []
  const vectors: Array<[string, (target: number) => string]> = [
    ...Object.entries(VECTORS).map(([name, build]): [string, (target: number) => string] => [
      name,
      (target) => buildExact(build, target)
    ]),
    // One valid JSON-LD block just under the 512 KiB JSON-LD cap, parsed, not cut.
    ['valid JSON-LD block under the cap', () => page(ldJson({ articleBody: 'w '.repeat(255_000) }))]
  ]
  for (const [name, build] of vectors) {
    for (const target of SIZES) {
      const html = build(target)
      const runs = [await timeOnce(scraper, html, 'https://example.com/')]
      if (runs[0] / 1e6 < STOP_MS / 2) {
        for (let i = 0; i < 4; i++) runs.push(await timeOnce(scraper, html, 'https://example.com/'))
      }
      const row: AttackRow = {
        vector: name,
        parser: 'headScraper',
        targetBytes: target,
        inputBytes: Buffer.byteLength(html),
        runs: runs.length,
        medianMs: ms(median(runs))
      }
      rows.push(row)
      console.log(`${name.padEnd(36)} ${String(row.inputBytes).padStart(8)} B  ${row.medianMs} ms`)
      if (row.medianMs > STOP_MS || name === 'valid JSON-LD block under the cap') break
    }
  }
  // pickIconHref is the other parser of untrusted HTML; the icon route reads 64 KiB at most.
  const unit = '<link rel="icon" href="'
  const iconHead = `<head>${unit.repeat(Math.floor((64 * 1024 - 13) / unit.length))}</head>`
  const iconRuns: number[] = []
  for (let i = 0; i < 5; i++) {
    const start = Bun.nanoseconds()
    pickIconHref(iconHead, 'https://example.com/')
    iconRuns.push(Bun.nanoseconds() - start)
  }
  rows.push({
    vector: 'pickIconHref crafted head',
    parser: 'pickIconHref',
    targetBytes: 64 * 1024,
    inputBytes: iconHead.length,
    runs: iconRuns.length,
    medianMs: ms(median(iconRuns))
  })
  console.log(`pickIconHref crafted head ${iconHead.length} B  ${ms(median(iconRuns))} ms`)

  mkdirSync(dir, { recursive: true })
  const out = join(dir, `attack-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  writeFileSync(out, JSON.stringify({ environment: environment(), rows }, null, 1))
  console.log(`\nresults: ${out}`)
}

// A page that answers with one of these is a wall, not the page, even when the call succeeds.
const WALL_RE =
  /just a moment|client challenge|attention required|access denied|are you a robot|captcha|verify you are human|before you continue|enable javascript|unsupported browser|page not found|^40[34]\b|^error\b/i
// `fallback` is the card the server builds when every stage misses: the host stands in for a title.
type Grade = 'full' | 'partial' | 'title-only' | 'fallback' | 'wall' | 'miss'
type CoverageRow = {
  section: string
  requested: string
  status: number
  grade: Grade
  ms: number
  cached?: boolean
  title?: string
  description?: string
  image: 'none' | 'ok' | `failed:${number}`
  icon: 'ok' | `failed:${number}`
}

// The image and icon load through our own routes, as the card loads them, so "ok" means it paints.
const probe = async (url: string) => {
  try {
    const response = await fetch(url)
    const type = response.headers.get('content-type') ?? ''
    await response.arrayBuffer()
    return response.ok && type.startsWith('image/') ? 'ok' : response.status || 1
  } catch {
    return 1
  }
}

const coverOne = async (base: string, entry: { section: string; url: string }) => {
  const started = performance.now()
  const response = await fetch(`${base}/api/metadata?url=${encodeURIComponent(entry.url)}`)
  const ms = Math.round(performance.now() - started)
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean
    url?: string
    requested_url?: string
    title?: string
    description?: string
    image?: { url?: string }
    cached?: boolean
  }
  const key = body.requested_url ?? entry.url
  const imageProbe = body.image?.url
    ? await probe(`${base}/api/metadata/image?url=${encodeURIComponent(key)}`)
    : 'none'
  const iconProbe = await probe(
    `${base}/api/metadata/icon?origin=${encodeURIComponent(new URL(entry.url).origin)}`
  )
  const image =
    imageProbe === 'none' || imageProbe === 'ok' ? imageProbe : (`failed:${imageProbe}` as const)
  const title = body.success ? body.title : undefined
  const gradeOf = (): Grade => {
    if (!title) return 'miss'
    const hosts = [new URL(body.url ?? entry.url).hostname, new URL(entry.url).hostname]
    if (hosts.includes(title) && !body.description && image === 'none') return 'fallback'
    if (WALL_RE.test(title) || WALL_RE.test(body.description ?? '')) return 'wall'
    if (image === 'ok' && body.description) return 'full'
    return body.description || image === 'ok' ? 'partial' : 'title-only'
  }
  const grade = gradeOf()
  const row: CoverageRow = {
    section: entry.section,
    requested: entry.url,
    status: response.status,
    grade,
    ms,
    cached: body.cached,
    title,
    description: body.description,
    image,
    icon: iconProbe === 'ok' ? 'ok' : `failed:${iconProbe}`
  }
  console.log(
    `${grade.padEnd(10)} ${String(ms).padStart(5)} ms  ${entry.url}  ${title ?? ''}`.slice(0, 160)
  )
  return row
}

// reference: headScraper against the page's own tags, read with plain regexes, as an outside check.
const REFERENCE_FIELDS = ['title', 'description', 'image'] as const
const metaTags = (html: string) => {
  const tags: Record<string, string> = {}
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const value = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag)
    if (key && value && !(key in tags)) tags[key] = decodeHTML(value[1] ?? value[2] ?? '').trim()
  }
  return tags
}
const referenceValues = (html: string): Record<(typeof REFERENCE_FIELDS)[number], string> => {
  const tags = metaTags(html)
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  return {
    title: tags['og:title'] || tags['twitter:title'] || (title ? decodeHTML(title).trim() : ''),
    description: tags['og:description'] || tags['twitter:description'] || tags['description'] || '',
    image:
      tags['og:image:secure_url'] ||
      tags['og:image:url'] ||
      tags['og:image'] ||
      tags['twitter:image:src'] ||
      tags['twitter:image'] ||
      ''
  }
}

// Folds typography, so a curly quote or an ellipsis is not a disagreement.
const foldText = (value: string) =>
  value
    .normalize('NFC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()

// A description may be cut and end in "..."; an image matches without its query string.
const agrees = (field: string, reference: string, ours: string, base: string) => {
  if (field === 'image') {
    try {
      return new URL(reference, base).href.split('?')[0] === ours.split('?')[0]
    } catch {
      return false
    }
  }
  const a = foldText(reference).toLowerCase()
  const b = foldText(ours).toLowerCase()
  return field === 'description'
    ? b.replace(/\.\.\.$/, '').length > 0 && a.startsWith(b.replace(/\.\.\.$/, ''))
    : a === b
}

const reference = async (dir: string) => {
  const scraper = createHeadScraper()
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { pages: Page[] }
  const counts = Object.fromEntries(
    REFERENCE_FIELDS.map((f) => [f, { agree: 0, differ: 0, onlyReference: 0, onlyOurs: 0 }])
  )
  const listed: { page: string; field: string; reference: string; ours: string }[] = []
  for (const page of manifest.pages) {
    const html = readFileSync(join(dir, 'pages', page.file), 'utf8')
    const want = referenceValues(html)
    const got = await scraper.scrape({ html, url: page.url })
    for (const field of REFERENCE_FIELDS) {
      const a = want[field]
      const b = got[field] ?? ''
      if (!a && !b) continue
      if (!a) counts[field].onlyOurs++
      else if (!b) counts[field].onlyReference++
      else if (agrees(field, a, b, page.url)) counts[field].agree++
      else counts[field].differ++
      if (a && !agrees(field, a, b, page.url))
        listed.push({ page: page.requested, field, reference: a, ours: b })
    }
  }
  const out = join(dir, `reference-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  writeFileSync(
    out,
    JSON.stringify(
      { environment: environment(), pages: manifest.pages.length, counts, listed },
      null,
      1
    )
  )
  console.log(`${JSON.stringify(counts)}\nresults: ${out}`)
}

// coverage: a live run against a REST server, so it measures the whole pipeline, not one stage.
// Clear the local `meta:*` cache keys first, or `cached` rows grade an older answer.
const coverage = async (dir: string, base = 'http://localhost:4000') => {
  const entries = readUrls()
  const rows: CoverageRow[] = new Array(entries.length)
  let next = 0
  const worker = async () => {
    while (next < entries.length) {
      const index = next++
      rows[index] = await coverOne(base, entries[index]).catch(() => ({
        section: entries[index].section,
        requested: entries[index].url,
        status: 0,
        grade: 'miss' as const,
        ms: 0,
        image: 'none' as const,
        icon: 'failed:1' as const
      }))
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))

  const grades: Grade[] = ['full', 'partial', 'title-only', 'fallback', 'wall', 'miss']
  const tally = (list: CoverageRow[]) =>
    Object.fromEntries(grades.map((g) => [g, list.filter((r) => r.grade === g).length]))
  const sections = [...new Set(rows.map((r) => r.section))]
  const summary = {
    urls: rows.length,
    cached: rows.filter((r) => r.cached).length,
    all: tally(rows),
    imageFailed: rows.filter((r) => r.image.startsWith('failed')).length,
    iconFailed: rows.filter((r) => r.icon !== 'ok').length,
    bySection: Object.fromEntries(
      sections.map((s) => [s, tally(rows.filter((r) => r.section === s))])
    )
  }
  mkdirSync(dir, { recursive: true })
  const out = join(dir, `coverage-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  writeFileSync(out, JSON.stringify({ environment: environment(), base, summary, rows }, null, 1))
  console.log(`\n${JSON.stringify(summary.all)}\nresults: ${out}`)
}

// The third argument is the iteration count for `run` and the REST base URL for `coverage`.
const [mode, dir, third, set = 'dev'] = process.argv.slice(2)
if (!dir)
  throw new Error(
    'usage: bench-link-extractor.ts fetch|run|attack|coverage|reference <dir> [third]'
  )
if (mode === 'fetch') await fetchCorpus(dir)
else if (mode === 'run') await runCorpus(dir, Number(third ?? 30), set)
else if (mode === 'attack') await attack(dir)
else if (mode === 'coverage') await coverage(dir, third)
else if (mode === 'reference') await reference(dir)
else throw new Error(`unknown mode: ${mode}`)
