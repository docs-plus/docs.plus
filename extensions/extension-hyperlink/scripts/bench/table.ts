import type { Behaviour } from './behaviour'
import type { Bytes, Size } from './bytes'
import type { Variant } from './paths'

type Speed = { unit: string } & Partial<Record<Variant, { median: number; sameDocAsBase: boolean }>>
export type BenchResult = {
  ref: string
  date: string
  where: string
  runs: number
  bytes: Record<Variant, Bytes>
  behaviour: Record<Variant, Behaviour>
  speed: Record<string, Speed>
}

const n = (x: number) => x.toLocaleString('en-US')
const signed = (x: number) => (x > 0 ? '+' : '') + n(x)
const pct = (a: number, b: number) =>
  a === 0 ? '—' : `${b >= a ? '+' : ''}${(((b - a) / a) * 100).toFixed(0)}%`
const size = (s: Size) => `${n(s.min)} / ${n(s.gz)}`

/** One table: `base` (the ref) against `head` (this tree). `control` sets the noise floor for speed. */
export function renderTable(r: BenchResult): string {
  const rows: string[][] = []
  const byteRow = (label: string, pick: (b: Bytes) => Size) => {
    const a = pick(r.bytes.base)
    const b = pick(r.bytes.head)
    rows.push([label, size(a), size(b), `${signed(b.min - a.min)} / ${signed(b.gz - a.gz)}`])
  }
  byteRow('Bytes: npm `dist/index.js` (min / gz)', (b) => b.distEsm)
  byteRow('Bytes: a StarterKit app pays (min / gz)', (b) => b.starterKitApp)
  byteRow('Bytes: `normalizeHref`-only import (min / gz)', (b) => b.helperOnly)
  const ba = r.behaviour.base
  const bh = r.behaviour.head
  rows.push([
    'Behaviour: all cases',
    `${ba.pass}/${ba.total}`,
    `${bh.pass}/${bh.total}`,
    signed(bh.pass - ba.pass)
  ])
  for (const g of Object.keys(bh.groups))
    rows.push([`Behaviour: ${g}`, ba.groups[g], bh.groups[g], ''])
  for (const [name, s] of Object.entries(r.speed)) {
    const a = s.base!
    const b = s.head!
    const noise = `control ${pct(a.median, s.control!.median)}`
    rows.push([
      `Speed: ${name} (${s.unit})`,
      String(a.median),
      String(b.median),
      `${pct(a.median, b.median)} · ${noise}${b.sameDocAsBase ? '' : ' · output differs'}`
    ])
  }
  const table = [
    '| Metric | base | head | Change |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n')
  const failing = bh.failed.length ? `\n\nStill failing on head: ${bh.failed.join('; ')}.` : ''
  return `base = \`${r.ref}\`, head = working tree. ${r.where}, ${r.runs} rounds, ${r.date}.\nA speed change smaller than the control's is noise.\n\n${table}${failing}`
}
