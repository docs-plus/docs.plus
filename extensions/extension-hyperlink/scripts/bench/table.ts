import type { Behaviour } from './behaviour'
import type { Bytes, Size } from './bytes'
import type { Variant } from './paths'

// `samples` holds every timed round in run order, so later sessions can be pooled or re-read.
type Speed = { unit: string } & Partial<
  Record<Variant, { median: number; sameDocAsBase: boolean; samples: number[] }>
>
// A `--bytes-only` run has no behaviour or speed.
export type BenchResult = {
  ref: string
  date: string
  where: string
  runs: number
  distSha256: Record<Variant, string>
  bytes: Record<Variant, Bytes>
  behaviour?: Record<Variant, Behaviour>
  speed?: Record<string, Speed>
}

export const n = (x: number): string => x.toLocaleString('en-US')
export const signed = (x: number): string => (x > 0 ? '+' : '') + n(x)
const pct = (a: number, b: number) =>
  a === 0 ? '—' : `${b >= a ? '+' : ''}${(((b - a) / a) * 100).toFixed(0)}%`
const size = (s?: Size) => (s ? `${n(s.min)} / ${n(s.gz)}` : '—')

/** One table: `base` (the ref) against `head` (this tree). `control` sets the noise floor for speed. */
export function renderTable(r: BenchResult): string {
  const rows: string[][] = []
  const byteRow = (label: string, pick: (b: Bytes) => Size | undefined) => {
    const a = pick(r.bytes.base)
    const b = pick(r.bytes.head)
    if (!a && !b) return
    const change = a && b ? `${signed(b.min - a.min)} / ${signed(b.gz - a.gz)}` : '—'
    rows.push([label, size(a), size(b), change])
  }
  byteRow('Bytes: npm `dist/index.js` (min / gz)', (b) => b.distEsm)
  byteRow('Bytes: a StarterKit app pays (min / gz)', (b) => b.starterKitApp)
  byteRow('Bytes: a StarterKit app with three own slots pays (min / gz)', (b) => b.slotsApp)
  byteRow('Bytes: a StarterKit app with `HyperlinkBase` pays (min / gz)', (b) => b.baseApp)
  byteRow('Bytes: `HyperlinkBase` with three own slots pays (min / gz)', (b) => b.baseSlotsApp)
  byteRow('Bytes: `normalizeHref`-only import (min / gz)', (b) => b.helperOnly)
  const ba = r.behaviour?.base
  const bh = r.behaviour?.head
  if (ba && bh) {
    rows.push([
      'Behaviour: all cases',
      `${ba.pass}/${ba.total}`,
      `${bh.pass}/${bh.total}`,
      signed(bh.pass - ba.pass)
    ])
    for (const g of Object.keys(bh.groups))
      rows.push([`Behaviour: ${g}`, ba.groups[g], bh.groups[g], ''])
  }
  for (const [name, s] of Object.entries(r.speed ?? {})) {
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
  const failing = bh?.failed.length ? `\n\nStill failing on head: ${bh.failed.join('; ')}.` : ''
  const how = r.speed ? `${r.where}, ${r.runs} rounds` : 'Bytes only'
  const noise = r.speed ? "\nA speed change smaller than the control's is noise." : ''
  return `base = \`${r.ref}\`, head = working tree. ${how}, ${r.date}.${noise}\n\n${table}${failing}`
}
