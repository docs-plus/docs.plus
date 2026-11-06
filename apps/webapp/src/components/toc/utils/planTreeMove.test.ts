import { getSchema } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, Selection, TextSelection } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { prosemirrorToYXmlFragment, ySyncPlugin } from '@tiptap/y-tiptap'
import type { TocTreeAddress } from '@types'
import * as Y from 'yjs'

import { outlineOf } from './outline'
import { addressForTarget, planTreeMove, treeMoveTransaction } from './planTreeMove'

const HeadingWithTocId = Heading.extend({
  addAttributes() {
    return { ...this.parent?.(), 'toc-id': { default: null } }
  }
})
const schema = getSchema([Document, Paragraph, Text, HeadingWithTocId])

type Block = [level: number, id: string, text?: string] | string

// `[2, 'a']` is an H2 with toc-id and text "a"; a bare string is a paragraph.
const makeDoc = (...blocks: Block[]) =>
  schema.nodeFromJSON({
    type: 'doc',
    content: blocks.map((b) =>
      typeof b === 'string'
        ? { type: 'paragraph', content: [{ type: 'text', text: b }] }
        : {
            type: 'heading',
            attrs: { level: b[0], 'toc-id': b[1] },
            content: (b[2] ?? b[1]) ? [{ type: 'text', text: b[2] ?? b[1] }] : []
          }
    )
  })

/** `title{a{a1} b}` from the outline; levels as `id:level`. */
function tree(doc: PMNode): string {
  const outline = outlineOf(doc)
  const render = (parentId: string | null): string =>
    outline
      .filter((n) => n.parentId === parentId)
      .map((n) => {
        const kids = render(n.id)
        return kids ? `${n.id}{${kids}}` : n.id
      })
      .join(' ')
  return render(null)
}
const levels = (doc: PMNode) => outlineOf(doc).map((n) => `${n.id}:${n.level}`)

const gap = (doc: PMNode, upperId: string | null, lowerId: string | null) =>
  addressForTarget(doc, { kind: 'gap', upperId, lowerId })
const inside = (doc: PMNode, id: string) => addressForTarget(doc, { kind: 'inside', id })

function move(doc: PMNode, sourceId: string, to: TocTreeAddress | null, locked = false) {
  if (!to) throw new Error('no address')
  const plan = planTreeMove(doc, sourceId, to, { locked })
  if (!plan.ok) return { reason: plan.reason, doc }
  return { reason: null, doc: treeMoveTransaction(EditorState.create({ doc }), plan).doc }
}

describe('planTreeMove named cases', () => {
  it('moves sub-headings with a demoted section', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], 'x', [3, 'a1'], [2, 'b'], 'y', [3, 'b1'], [2, 'c'])
    const out = move(doc, 'b', gap(doc, 'a', 'a1'))
    expect(tree(out.doc)).toBe('title{a{b{b1} a1} c}')
    expect(levels(out.doc)).toEqual(['title:1', 'a:2', 'b:3', 'b1:4', 'a1:3', 'c:2'])
  })

  it('moves sub-headings with a promoted section', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [3, 'a1'], [4, 'a1a'], [3, 'a2'], [2, 'b'])
    const out = move(doc, 'a1', gap(doc, 'a2', 'b'))
    expect(tree(out.doc)).toBe('title{a{a2} a1{a1a} b}')
    expect(levels(out.doc)).toEqual(['title:1', 'a:2', 'a2:3', 'a1:2', 'a1a:3', 'b:2'])
  })

  it('never captures the following sibling', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [2, 'b'], [2, 'c'])
    expect(tree(move(doc, 'a', gap(doc, 'b', 'c')).doc)).toBe('title{b a c}')

    // Skip level: the slot before an H4 child lands at H4, beside it, not over it.
    const skip = makeDoc([1, 'title'], [2, 'x'], [2, 't'], [4, 'c1'], [2, 'z'])
    const out = move(skip, 'x', gap(skip, 't', 'c1'))
    expect(tree(out.doc)).toBe('title{t{x c1} z}')
    expect(levels(out.doc)).toContain('x:4')
  })

  it('counts the index with the source still in place on a down-move', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [2, 'b'], [2, 'c'], [2, 'd'])
    expect(tree(move(doc, 'a', gap(doc, 'c', 'd')).doc)).toBe('title{b c a d}')
    expect(tree(move(doc, 'a', gap(doc, 'd', null)).doc)).toBe('title{b c d a}')
  })

  it('keeps the Title fixed and lands nothing above it', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [2, 'b'])
    expect(move(doc, 'title', { parentId: null, index: 1 }).reason).toBe('title-fixed')
    expect(move(doc, 'b', gap(doc, null, 'title')).reason).toBe('above-title')
  })

  it('refuses a slot inside the moved set', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [3, 'a1'], [2, 'b'])
    expect(move(doc, 'a', { parentId: 'a', index: 0 }).reason).toBe('inside-own-set')
    expect(move(doc, 'a', { parentId: 'a1', index: 0 }).reason).toBe('inside-own-set')
  })

  it('derives a skipped level from the slot (H3 parent, H5 child)', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [3, 'b'], [5, 'c'], [2, 'x'])
    const out = move(doc, 'x', gap(doc, 'b', 'c'))
    expect(tree(out.doc)).toBe('title{a{b{x c}}}')
    expect(levels(out.doc)).toContain('x:5')
  })

  it('lands below a folded row after its whole section', () => {
    // Folded a1 has no visible row, so the gap below `a` is the gap before `b`.
    const doc = makeDoc([1, 'title'], [2, 'a'], [3, 'a1'], [2, 'b'], [2, 'y'])
    expect(tree(move(doc, 'y', gap(doc, 'a', 'b')).doc)).toBe('title{a{a1} y b}')
  })

  it('squashes the set at H6 without touching anything outside it', () => {
    const doc = makeDoc(
      [1, 'title'],
      [2, 'a'],
      [3, 'a1'],
      [2, 'b'],
      [3, 'b1'],
      [4, 'b2'],
      [5, 'b3'],
      [6, 'b4']
    )
    const out = move(doc, 'b', { parentId: 'a1', index: 0 })
    expect(levels(out.doc)).toEqual([
      'title:1',
      'a:2',
      'a1:3',
      'b:4',
      'b1:5',
      'b2:6',
      'b3:6',
      'b4:6'
    ])
  })

  it('refuses an H6 parent and a locked pad', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [6, 'f'], [2, 'b'])
    expect(move(doc, 'b', { parentId: 'f', index: 0 }).reason).toBe('no-room')
    expect(move(doc, 'b', gap(doc, 'a', 'f'), true).reason).toBe('locked')
  })

  it('is a noop at its own slot, and normalizes a deep first child there', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [3, 'a1'], [2, 'b'])
    expect(move(doc, 'b', gap(doc, 'a1', 'b')).reason).toBe('noop')
    expect(move(doc, 'a', gap(doc, 'title', 'a')).reason).toBe('noop')

    const deep = makeDoc([1, 'title'], [4, 'x'], [5, 'x1'])
    const out = move(deep, 'x', gap(deep, 'title', 'x'))
    expect(levels(out.doc)).toEqual(['title:1', 'x:2', 'x1:3'])
  })

  it('nests inside a leaf as its first child, and inside a parent as its last child', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [3, 'a1'], [2, 'b'], [2, 'c'], [3, 'c1'])
    const leaf = move(doc, 'c', inside(doc, 'b'))
    expect(tree(leaf.doc)).toBe('title{a{a1} b{c{c1}}}')
    expect(levels(leaf.doc)).toContain('c1:4')
    expect(tree(move(doc, 'b', inside(doc, 'a')).doc)).toBe('title{a{a1 b} c{c1}}')
    expect(move(doc, 'a', inside(doc, 'a1')).reason).toBe('inside-own-set')
  })

  it('keeps an empty heading in the outline, so its sub-headings stay its children', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], [2, 'e', ''], [3, 'b'])
    expect(tree(doc)).toBe('title{a e{b}}')
    expect(tree(move(doc, 'a', gap(doc, 'b', null)).doc)).toBe('title{e{b a}}')
  })

  it('keeps the caret in the moved text', () => {
    const doc = makeDoc([1, 'title'], [2, 'a'], 'alpha', [2, 'b'], 'bravo body')
    const plan = planTreeMove(doc, 'b', { parentId: 'title', index: 0 }, { locked: false })
    if (!plan.ok) throw new Error(plan.reason)
    const caret = plan.from + doc.nodeAt(plan.from)!.nodeSize + 3 // inside "bravo body"
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, caret) })
    const tr = treeMoveTransaction(state, plan)
    const $caret = tr.doc.resolve(tr.selection.from)
    expect($caret.parent.textContent).toBe('bravo body')
    expect($caret.parentOffset).toBe(2)
  })
})

describe('treeMoveTransaction with a live peer', () => {
  // #510: rebuilt headings made y-sync re-create them, so the peer's caret jumped to Z.
  it("keeps an online peer's caret in a shifted sub-heading", () => {
    const start = makeDoc(
      [1, 'title'],
      [2, 'a'],
      'a0',
      [2, 'x', 'Xhead'],
      'x0',
      [3, 'x1', 'X1head'],
      'x1text',
      [2, 'z'],
      'z0'
    )
    const mover = new Y.Doc()
    const peer = new Y.Doc()
    prosemirrorToYXmlFragment(start, mover.getXmlFragment('default'))
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(mover))
    mover.on('update', (update: Uint8Array) => Y.applyUpdate(peer, update, 'relay'))
    const viewOf = (ydoc: Y.Doc) =>
      new EditorView(document.createElement('div'), {
        state: EditorState.create({
          schema,
          plugins: [ySyncPlugin(ydoc.getXmlFragment('default'))]
        })
      })
    const moverView = viewOf(mover)
    const peerView = viewOf(peer)

    let at = 0
    peerView.state.doc.forEach((n, offset) => {
      if (n.textContent === 'X1head') at = offset + 3
    })
    peerView.dispatch(
      peerView.state.tr.setSelection(Selection.near(peerView.state.doc.resolve(at)))
    )

    const plan = planTreeMove(moverView.state.doc, 'x', inside(moverView.state.doc, 'a')!, {
      locked: false
    })
    if (!plan.ok || plan.d !== 1) throw new Error('expected a +1 shift')
    moverView.dispatch(treeMoveTransaction(moverView.state, plan))

    expect(levels(peerView.state.doc)).toEqual(['title:1', 'a:2', 'x:3', 'x1:4', 'z:2'])
    const { $head } = peerView.state.selection
    expect([$head.parent.textContent, $head.parentOffset]).toEqual(['X1head', 2])
    moverView.destroy()
    peerView.destroy()
  })
})

// Seeded so a failure names a reproducible document.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomDoc(rand: () => number): PMNode {
  const blocks: Block[] = [[1, 'title'], 'intro']
  const count = 3 + Math.floor(rand() * 8)
  for (let i = 0; i < count; i++) {
    const level = rand() < 0.08 ? 1 : 2 + Math.floor(rand() * 5)
    blocks.push([level, `h${i}`, rand() < 0.1 ? '' : `h${i}`])
    const body = Math.floor(rand() * 3)
    for (let j = 0; j < body; j++) blocks.push(`p${i}.${j}`)
  }
  return makeDoc(...blocks)
}

const blockKeys = (doc: PMNode) => {
  const keys: string[] = []
  doc.forEach((n) => keys.push(n.attrs['toc-id'] ?? n.textContent))
  return keys
}

describe('planTreeMove property', () => {
  it('holds the move invariants for every source and every gap', () => {
    const seed = 20261104
    const rand = mulberry32(seed)
    let placed = 0

    for (let docNo = 0; docNo < 300; docNo++) {
      const doc = randomDoc(rand)
      const before = outlineOf(doc)
      const byId = new Map(before.map((n) => [n.id, n]))
      const visible = (id: string) => doc.nodeAt(byId.get(id)!.pos)!.textContent !== ''

      for (const source of before) {
        if (source.isTitle || !visible(source.id)) continue
        const inSet = (n: { pos: number }) => n.pos >= source.pos && n.pos < source.sectionTo
        const setIds = before.filter(inSet).map((n) => n.id)
        const rows = before.filter((n) => !inSet(n) && visible(n.id))

        for (let g = 0; g <= rows.length; g++) {
          const where = `seed ${seed} doc ${docNo} ${source.id} gap ${g}: ${tree(doc)}`
          const address = gap(doc, rows[g - 1]?.id ?? null, rows[g]?.id ?? null)!
          const plan = planTreeMove(doc, source.id, address, { locked: false })
          if (!plan.ok) {
            expect([where, plan.reason]).toEqual([where, g === 0 ? 'above-title' : 'noop'])
            continue
          }
          placed++

          const caret = source.pos + 1
          const state = EditorState.create({ doc, selection: TextSelection.create(doc, caret) })
          const tr = treeMoveTransaction(state, plan)
          const after = new Map(outlineOf(tr.doc).map((n) => [n.id, n]))

          // Content and ids survive; the set stays whole and in order.
          const keys = blockKeys(doc)
          const setKeys = blockKeys(doc.cut(source.pos, source.sectionTo))
          const newKeys = blockKeys(tr.doc)
          const at = newKeys.indexOf(source.id)
          expect([where, newKeys.slice(at, at + setKeys.length)]).toEqual([where, setKeys])
          const rest = [...newKeys.slice(0, at), ...newKeys.slice(at + setKeys.length)]
          const restBefore = keys.filter(
            (_, i) => i < keys.indexOf(source.id) || i >= keys.indexOf(source.id) + setKeys.length
          )
          expect([where, rest]).toEqual([where, restBefore])

          for (const n of before) {
            const moved = after.get(n.id)!
            if (setIds.includes(n.id)) {
              expect([where, n.id, moved.level]).toEqual([
                where,
                n.id,
                Math.min(6, Math.max(1, n.level + plan.d))
              ])
            } else {
              expect([where, n.id, moved.parentId, moved.level]).toEqual([
                where,
                n.id,
                n.parentId,
                n.level
              ])
            }
          }

          const landed = after.get(source.id)!
          expect([where, landed.parentId, landed.level]).toEqual([where, address.parentId, plan.L])
          expect([where, after.get('title')!.pos, after.get('title')!.level]).toEqual([where, 0, 1])
          expect([where, tr.selection.from]).toEqual([where, landed.pos + 1])
        }
      }
    }

    expect(placed).toBeGreaterThan(5000)
  })
})
