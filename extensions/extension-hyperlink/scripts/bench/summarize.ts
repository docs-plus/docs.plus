/**
 * Pools saved browser sessions (one JSON per session, from browser.ts or drive.ts) into one table:
 * head/base per session, the control/base noise floor, its log sigma and the MDE at this session count.
 * Usage: bun scripts/bench/summarize.ts <session.json> <session.json> ...
 */
/* eslint-disable no-console -- a CLI that prints its report */
type Run = { median: number }
type Session = {
  ref?: string
  userAgent?: string
  background?: boolean
  crossOriginIsolated?: boolean
  distSha256?: Record<string, string>
  speed: Record<string, { unit: string; base: Run; control: Run; head: Run }>
}

const files = Bun.argv.slice(2)
if (files.length < 2) throw new Error('Pass at least two session files: sigma needs two.')
const sessions: Session[] = await Promise.all(files.map((f) => Bun.file(f).json()))

const warnings = new Set<string>()
const same = (label: string, pick: (s: Session) => unknown) => {
  if (new Set(sessions.map((s) => JSON.stringify(pick(s)))).size > 1)
    warnings.add(`${label} differs between sessions.`)
}
same('ref', (s) => s.ref)
same('Browser', (s) => s.userAgent)
same('The dist sha256', (s) => s.distSha256)
sessions.forEach((s, i) => {
  if (s.background) warnings.add(`${files[i]} ran as a background page.`)
  // A file with no such field predates the settle step and COOP/COEP: do not pool it with new ones.
  if (s.crossOriginIsolated !== true) warnings.add(`${files[i]} was not cross-origin isolated.`)
})
if (sessions.length < 5) warnings.add('Under 5 sessions the MDE reads too small; plan for 6.')

const sorted = (a: number[]) => [...a].sort((x, y) => x - y)
const mid = (a: number[]) => {
  const s = sorted(a)
  const h = s.length >> 1
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2
}
const pct = (ratio: number) => `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)}%`
const range = (a: number[]) => `${pct(Math.min(...a))} to ${pct(Math.max(...a))}`
const sd = (a: number[]) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1))
}
// Student t quantile from the normal one (Cornish-Fisher): about 1% low at 5 df (6 sessions), closer above.
const t = (z: number, df: number) =>
  z + (z ** 3 + z) / (4 * df) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df ** 2)
const n = sessions.length
const mdeFactor = (t(1.959964, n - 1) + t(0.841621, n - 1)) / Math.sqrt(n)

const rows = Object.keys(sessions[0].speed).map((name) => {
  const per = sessions.map((s) => s.speed[name])
  const head = per.map((w) => w.head.median / w.base.median)
  const control = per.map((w) => w.control.median / w.base.median)
  const sigma = sd(control.map(Math.log))
  return [
    `${name} (${per[0].unit})`,
    `${pct(mid(head))} (${range(head)})`,
    head.map(pct).join(', '),
    range(control),
    sigma.toFixed(4),
    `±${((Math.exp(sigma * mdeFactor) - 1) * 100).toFixed(1)}%`
  ]
})

console.log(`${n} sessions: ${files.join(', ')}\n`)
console.log(
  '| Workload | head/base, median (range) | Per session | control/base range | σ ln(control/base) | MDE |'
)
console.log('| --- | --- | --- | --- | --- | --- |')
for (const row of rows) console.log(`| ${row.join(' | ')} |`)
if (warnings.size) console.log(`\n${[...warnings].map((w) => `Warning: ${w}`).join('\n')}`)

export {}
