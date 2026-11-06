import * as Y from 'yjs'

import {
  countDuplicateIds,
  planHeadingIdRepair,
  type RepairBlock,
  repairedHeadingId,
  repairHeadingIds
} from './repair-heading-ids'

// `H2 A` is an H2 with toc-id A; `H2 A peer` adds text; `H1 -` has no id; anything else is a paragraph.
const blocks = (...lines: string[]): RepairBlock[] =>
  lines.map((line, i) => {
    const m = /^H(\d) (\S+)/.exec(line)
    return {
      heading: !!m,
      level: m ? Number(m[1]) : 0,
      id: m && m[2] !== '-' ? m[2] : null,
      key: () => line,
      client: 2,
      clock: 100 + i
    }
  })

/** The block list after the plan, with re-keyed ids shown as `~`. */
function apply(lines: string[]) {
  const plan = planHeadingIdRepair(blocks(...lines))
  const rekeyed = new Map(plan.rekeys.map((r) => [r.index, r.id]))
  const out = lines
    .map((line, i) => (rekeyed.has(i) ? line.replace(/^(H\d) \S+/, '$1 ~') : line))
    .filter((_, i) => !plan.deletes.includes(i))
  return { out, plan }
}

describe('planHeadingIdRepair', () => {
  it('does nothing without a duplicate id', () => {
    expect(apply(['H1 T', 'p t0', 'H2 A', 'p a0']).plan).toEqual({ deletes: [], rekeys: [] })
  })

  it('deletes a later set equal to the first (R-1, R-2)', () => {
    const { out } = apply(['H1 T', 'H2 X', 'p x0', 'H2 A', 'p a0', 'H2 B', 'H2 A', 'p a0', 'H2 Z'])
    expect(out).toEqual(['H1 T', 'H2 X', 'p x0', 'H2 A', 'p a0', 'H2 B', 'H2 Z'])
  })

  it('takes the sub-headings of an equal set with it', () => {
    const lines = ['H1 T', 'H2 A', 'H3 A1', 'p a1', 'H2 B', 'H2 A', 'H3 A1', 'p a1', 'H2 Z']
    expect(apply(lines).out).toEqual(['H1 T', 'H2 A', 'H3 A1', 'p a1', 'H2 B', 'H2 Z'])
  })

  it('re-keys a different later set and keeps its content (R-1t)', () => {
    const { out, plan } = apply(['H1 T', 'H2 B', 'p b0', 'H2 A', 'H2 B', 'p PEER-b0'])
    expect(out).toEqual(['H1 T', 'H2 B', 'p b0', 'H2 A', 'H2 ~', 'p PEER-b0'])
    expect(plan.rekeys).toEqual([{ index: 4, id: repairedHeadingId('B', 2, 104) }])
  })

  it('keeps the first copy in document order as the owner', () => {
    const { out } = apply(['H1 T', 'H2 B', 'p PEER-b0', 'H2 B', 'p b0'])
    expect(out).toEqual(['H1 T', 'H2 B', 'p PEER-b0', 'H2 ~', 'p b0'])
  })

  it('deletes a bare twin before an equal heading (R-5)', () => {
    const lines = ['H1 T', 'H2 A', 'p a0', 'H3 X', 'H3 X', 'p x0', 'H2 B', 'p b0', 'H2 B', 'p b0']
    expect(apply(lines).out).toEqual(['H1 T', 'H2 A', 'p a0', 'H3 X', 'p x0', 'H2 B', 'p b0'])
  })

  it('keeps a bare copy whose next block is not its equal', () => {
    // Bare, but the next heading is another id: re-key, never delete.
    expect(apply(['H1 T', 'H2 X', 'p x0', 'H2 X', 'H2 Z']).out).toEqual([
      'H1 T',
      'H2 X',
      'p x0',
      'H2 ~',
      'H2 Z'
    ])
    // Same id, other text: not a twin.
    expect(apply(['H1 T', 'H2 X', 'H2 X peer', 'p x0']).out).toEqual([
      'H1 T',
      'H2 X',
      'H2 ~ peer',
      'p x0'
    ])
  })

  it('never pairs headings without an id', () => {
    const lines = ['H1 T', 'H1 -', 'p b0', 'H1 -', 'p b0', 'H1 -', 'H1 -']
    expect(apply(lines).plan).toEqual({ deletes: [], rekeys: [] })
  })

  it('reads a nested duplicate inside a re-keyed set', () => {
    const lines = ['H1 T', 'H2 A', 'H3 A1', 'p a1', 'H2 A', 'p new', 'H3 A1', 'p a1', 'H2 Z']
    expect(apply(lines).out).toEqual(['H1 T', 'H2 A', 'H3 A1', 'p a1', 'H2 ~', 'p new', 'H2 Z'])
  })

  it('reads keys only for duplicated sets', () => {
    const read: number[] = []
    const list = blocks('H1 T', 'p t0', 'H2 A', 'p a0', 'H2 A', 'p a0', 'H2 Z', 'p z0').map(
      (b, i) => ({ ...b, key: () => (read.push(i), b.key()) })
    )
    planHeadingIdRepair(list)
    expect(read.every((i) => i >= 2 && i <= 5)).toBe(true)
  })
})

describe('repairedHeadingId', () => {
  it('gives the same 16-char base62 id for the same item, and another for another', () => {
    const id = repairedHeadingId('B', 2, 9)
    expect(id).toMatch(/^[0-9A-Za-z]{16}$/)
    expect(repairedHeadingId('B', 2, 9)).toBe(id)
    expect(repairedHeadingId('B', 2, 10)).not.toBe(id)
    expect(repairedHeadingId('B', 3, 9)).not.toBe(id)
  })

  it('steps past an id that is already taken', () => {
    const first = repairedHeadingId('B', 2, 9)
    const next = repairedHeadingId('B', 2, 9, new Set([first]))
    expect(next).toMatch(/^[0-9A-Za-z]{16}$/)
    expect(next).not.toBe(first)
  })
})

describe('countDuplicateIds', () => {
  it('counts ids and extra copies, and skips null and empty ids', () => {
    expect(countDuplicateIds(['T', 'A', 'B', 'A', 'A', null, null, '', ''])).toEqual({
      duplicateIds: 1,
      extraCopies: 2
    })
    expect(countDuplicateIds(['T', 'A', null, null])).toBeNull()
  })
})

describe('repairHeadingIds on a Yjs fragment', () => {
  const el = (name: string, attrs: Record<string, unknown>, text: string) => {
    const node = new Y.XmlElement(name)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v as string)
    node.insert(0, [new Y.XmlText(text)])
    return node
  }
  const outline = (fragment: Y.XmlFragment) =>
    fragment
      .toArray()
      .map((n) => {
        const e = n as Y.XmlElement
        return e.nodeName === 'heading' ? `${e.getAttribute('toc-id')}` : e.toString()
      })
      .join(' ')

  it('writes one transaction under its origin, and a second run is a no-op', () => {
    const doc = new Y.Doc()
    const fragment = doc.getXmlFragment('default')
    fragment.insert(0, [
      el('heading', { level: 1, 'toc-id': 'T' }, 'Title'),
      el('heading', { level: 2, 'toc-id': 'A' }, 'A'),
      el('paragraph', {}, 'a0'),
      el('heading', { level: 2, 'toc-id': 'A' }, 'A'),
      el('paragraph', {}, 'a0'),
      el('heading', { level: 2, 'toc-id': 'B' }, 'B'),
      el('paragraph', {}, 'b0'),
      el('heading', { level: 2, 'toc-id': 'B' }, 'B'),
      el('paragraph', {}, 'PEER-b0')
    ])
    const origins: unknown[] = []
    doc.on('afterTransaction', (tr: Y.Transaction) => origins.push(tr.origin))
    const origin = Symbol('repair')

    expect(repairHeadingIds(fragment, origin)).toBe(true)
    expect(origins).toEqual([origin])
    const rekeyed = (fragment.get(5) as Y.XmlElement).getAttribute('toc-id')
    expect(outline(fragment)).toBe(
      `T A <paragraph>a0</paragraph> B <paragraph>b0</paragraph> ${rekeyed} <paragraph>PEER-b0</paragraph>`
    )
    expect(rekeyed).toMatch(/^[0-9A-Za-z]{16}$/)
    expect(repairHeadingIds(fragment, origin)).toBe(false)
  })
})
