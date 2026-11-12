import { combineTransactionSteps, getChangedRanges } from '@tiptap/core'
import { type Node as PMNode, Schema } from '@tiptap/pm/model'
import { addListNodes, wrapInList } from '@tiptap/pm/schema-list'
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state'
import { liftTarget } from '@tiptap/pm/transform'
import { describe, expect, it } from 'bun:test'

import { changedRanges } from '../changedRanges'

// Differential test: the linear pass must equal Tiptap's quadratic one, ranges and position map.
// Blocks, an inline image (for node marks) and lists, so every step type can occur.
const base = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
    blockquote: { group: 'block', content: 'block+' },
    text: { group: 'inline' },
    image: { group: 'inline', inline: true, attrs: { src: {} } }
  },
  marks: { strong: {}, em: {} }
})
const schema = new Schema({
  nodes: addListNodes(base.spec.nodes, 'paragraph block*', 'block'),
  marks: base.spec.marks
})

// Seeded so a failure names a case that reproduces.
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function startDoc(random: () => number): PMNode {
  const blocks = Array.from({ length: 3 + Math.floor(random() * 4) }, (_, i) =>
    schema.node('paragraph', null, [
      schema.text(`para ${i} see example${i}.com and `),
      schema.text('bold', [schema.marks.strong.create()]),
      schema.text(' end')
    ])
  )
  return schema.node('doc', null, [
    ...blocks,
    schema.node('paragraph', null, [schema.node('image', { src: 'x.png' }), schema.text(' pic')])
  ])
}

type Edit = (tr: Transaction, random: () => number) => void
const pos = (tr: Transaction, random: () => number) =>
  1 + Math.floor(random() * (tr.doc.content.size - 2))
const textRange = (tr: Transaction, random: () => number): [number, number] => {
  const a = pos(tr, random)
  const b = Math.min(tr.doc.content.size - 1, a + Math.floor(random() * 12))
  return [a, b]
}
const inTextblock = (tr: Transaction, at: number) => tr.doc.resolve(at).parent.isTextblock

const EDITS: Record<string, Edit> = {
  insertText: (tr, r) => {
    const at = pos(tr, r)
    if (inTextblock(tr, at)) tr.insertText(r() < 0.3 ? ' ' : 'xy', at)
  },
  deleteRange: (tr, r) => {
    const [a, b] = textRange(tr, r)
    if (inTextblock(tr, a) && tr.doc.resolve(a).sameParent(tr.doc.resolve(b))) tr.delete(a, b)
  },
  addMark: (tr, r) => tr.addMark(...textRange(tr, r), schema.marks.em.create()),
  removeMark: (tr, r) => tr.removeMark(...textRange(tr, r), schema.marks.strong),
  splitBlock: (tr, r) => {
    const at = pos(tr, r)
    if (inTextblock(tr, at)) tr.split(at)
  },
  setBlockType: (tr, r) => {
    const at = pos(tr, r)
    tr.setBlockType(at, at, schema.nodes.heading, { level: 2 })
  },
  wrapBlockquote: (tr, r) => {
    const $at = tr.doc.resolve(pos(tr, r))
    const range = $at.blockRange()
    if (range) {
      try {
        tr.wrap(range, [{ type: schema.nodes.blockquote }])
      } catch {
        // Not every range can be wrapped; skip it.
      }
    }
  },
  lift: (tr, r) => {
    const range = tr.doc.resolve(pos(tr, r)).blockRange()
    const target = range && liftTarget(range)
    if (range && target !== null && target !== undefined) tr.lift(range, target)
  },
  wrapInList: (tr, r) => {
    const at = pos(tr, r)
    if (!inTextblock(tr, at)) return
    const state = EditorState.create({ doc: tr.doc, selection: TextSelection.create(tr.doc, at) })
    wrapInList(schema.nodes.bullet_list)(state, (listTr) => listTr.steps.forEach((s) => tr.step(s)))
  },
  setNodeAttr: (tr) => {
    tr.doc.descendants((node, at) => {
      if (node.type === schema.nodes.heading) tr.setNodeAttribute(at, 'level', 3)
    })
  },
  nodeMark: (tr) => {
    tr.doc.descendants((node, at) => {
      if (node.type === schema.nodes.image) tr.addNodeMark(at, schema.marks.em.create())
    })
  }
}
const NAMES = Object.keys(EDITS)

// A transaction made against an older doc, then rebased: what a collab client receives.
function addRebased(tr: Transaction, earlier: Transaction, random: () => number): void {
  const concurrent = EditorState.create({ doc: earlier.before }).tr
  EDITS[NAMES[Math.floor(random() * 3)]](concurrent, random)
  for (const step of concurrent.steps) {
    const mapped = step.map(earlier.mapping)
    if (mapped) tr.maybeStep(mapped)
  }
}

const stepKinds = new Set<string>()

function runCase(seed: number) {
  const random = rng(seed)
  const doc0 = startDoc(random)
  let state = EditorState.create({ doc: doc0 })
  const transactions: Transaction[] = []
  for (let t = 0; t < 1 + Math.floor(random() * 4); t++) {
    const tr = state.tr
    const earlier = transactions[transactions.length - 1]
    if (earlier && random() < 0.25) addRebased(tr, earlier, random)
    for (let e = 0; e < 1 + Math.floor(random() * 4); e++)
      EDITS[NAMES[Math.floor(random() * NAMES.length)]](tr, random)
    if (!tr.steps.length) continue
    transactions.push(tr)
    state = state.apply(tr)
  }
  if (!transactions.length) return null
  for (const tr of transactions) for (const step of tr.steps) stepKinds.add(step.constructor.name)
  const transform = combineTransactionSteps(doc0, transactions)
  const ours = changedRanges(transactions)
  const positions = Array.from({ length: doc0.content.size + 1 }, (_, i) => i)
  return {
    expected: {
      changes: getChangedRanges(transform),
      map: positions.map((p) => transform.mapping.map(p))
    },
    actual: { changes: ours.changes, map: positions.map((p) => ours.map(p)) }
  }
}

describe('changedRanges equals Tiptap getChangedRanges', () => {
  it('matches on 1,500 seeded cases of mixed steps and transactions', () => {
    let compared = 0
    for (let seed = 1; seed <= 1500; seed++) {
      const result = runCase(seed)
      if (!result) continue
      compared++
      expect({ seed, ...result.actual }).toEqual({ seed, ...result.expected })
    }
    expect(compared).toBeGreaterThan(1000)
    // The cases must reach every step type the editor can send, or the match proves little.
    expect([...stepKinds].sort()).toEqual([
      'AddMarkStep',
      'AddNodeMarkStep',
      'AttrStep',
      'RemoveMarkStep',
      'ReplaceAroundStep',
      'ReplaceStep'
    ])
  })

  it('a pure mark transaction maps every position to itself', () => {
    const doc = startDoc(rng(7))
    const tr = EditorState.create({ doc }).tr.addMark(
      1,
      doc.content.size - 1,
      schema.marks.em.create()
    )
    const { changes, map } = changedRanges([tr])
    expect(changes).toEqual(getChangedRanges(combineTransactionSteps(doc, [tr])))
    expect(map(5)).toBe(5)
  })
})
