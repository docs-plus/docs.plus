import '../../link-icons/__tests__/setupDom'

import { Editor, Extension, Mark } from '@tiptap/core'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { afterEach, describe, expect, it } from 'bun:test'
import * as Y from 'yjs'

import { Hyperlink } from '../../hyperlink'
import { Doc, Paragraph as BareParagraph, Text } from '../../link-icons/__tests__/minimalSchema'

// docs.plus loads y-tiptap with the key `y-sync$1`. Taking `y-sync` first gives the same suffix here,
// so a check that reads the plain `y-sync$` key fails this file. `--isolate` keeps the counter per file.
new PluginKey('y-sync')
const { Collaboration } = await import('@tiptap/extension-collaboration')
const { ySyncPluginKey, yUndoPluginKey } = await import('@tiptap/y-tiptap')

// `stamp` lets StampOnPeerChange below change the doc without changing any text.
const Paragraph = BareParagraph.extend({ addAttributes: () => ({ stamp: { default: null } }) })
const Bold = Mark.create({
  name: 'bold',
  parseHTML: () => [{ tag: 'strong' }],
  renderHTML: () => ['strong', 0]
})

// Answers a peer's change with its own doc change, as a pad's block-id plugin can. Priority 1001
// runs it before Hyperlink, so autolink sees its transaction alone, with the peer's one as root.
let stamp = 0
const isPeerChange = (tr: Transaction) =>
  tr.docChanged && !!(tr.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean })?.isChangeOrigin
const StampOnPeerChange = Extension.create({
  name: 'stampOnPeerChange',
  priority: 1001,
  addProseMirrorPlugins: () => [
    new Plugin({
      appendTransaction: (trs, _old, state) => {
        const node = state.doc.nodeAt(0)
        if (!trs.some(isPeerChange) || node?.type.name !== 'paragraph') return
        return state.tr.setNodeMarkup(0, undefined, { ...node.attrs, stamp: ++stamp })
      }
    })
  ]
})

const editors: Editor[] = []
function peer(ydoc: Y.Doc, extra: Extension[] = []): Editor {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [
      Doc,
      Paragraph,
      Text,
      Bold,
      ...extra,
      Collaboration.configure({ document: ydoc }),
      Hyperlink.configure({ autolink: true })
    ]
  })
  editors.push(editor)
  return editor
}
afterEach(() => editors.splice(0).forEach((e) => e.destroy()))

/** Two-way sync. `hold()` queues updates, like a slow network; `flush()` delivers them. */
function connect(a: Y.Doc, b: Y.Doc) {
  const queue: [Uint8Array, Y.Doc, Y.Doc][] = []
  let held = false
  const relay = (from: Y.Doc, to: Y.Doc) => (update: Uint8Array, origin: unknown) => {
    if (origin === to) return
    if (held) queue.push([update, to, from])
    else Y.applyUpdate(to, update, from)
  }
  a.on('update', relay(a, b))
  b.on('update', relay(b, a))
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a), a)
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b), b)
  return {
    hold: () => (held = true),
    flush: () => {
      held = false
      queue.splice(0).forEach(([update, to, from]) => Y.applyUpdate(to, update, from))
    }
  }
}

function pair(extra: Extension[] = []) {
  const da = new Y.Doc()
  const db = new Y.Doc()
  const net = connect(da, db)
  return { da, db, net, A: peer(da, extra), B: peer(db, extra) }
}

/** Types like a keyboard: `handleTextInput` first, then a plain insert. */
function type(editor: Editor, text: string) {
  const { view } = editor
  for (const ch of text) {
    const { from, to } = view.state.selection
    const insert = () => view.state.tr.insertText(ch, from, to)
    if (!view.someProp('handleTextInput', (f) => f(view, from, to, ch, insert)))
      view.dispatch(insert())
  }
}
function typeAt(editor: Editor, pos: number, text: string) {
  editor.commands.setTextSelection(pos)
  type(editor, text)
}
const end = (e: Editor) => e.state.doc.content.size - 1
const selectAll = (e: Editor) => e.commands.setTextSelection({ from: 1, to: end(e) })

/** Links as `[text](href)`, bold as `**text**`, blocks joined by ' | '. */
function show(editor: Editor): string {
  const blocks: string[] = []
  editor.state.doc.forEach((block) => {
    let out = ''
    block.forEach((n) => {
      let t = n.text ?? ''
      const link = n.marks.find((m) => m.type.name === 'hyperlink')
      if (n.marks.some((m) => m.type.name === 'bold')) t = `**${t}**`
      out += link ? `[${t}](${link.attrs.href})` : t
    })
    blocks.push(out)
  })
  return blocks.join(' | ')
}

/** The links the shared Y.Doc holds: what the server stores and every new peer loads. */
function yLinks(ydoc: Y.Doc): string[] {
  const out: string[] = []
  const walk = (node: Y.XmlFragment | Y.XmlElement | Y.XmlText | Y.XmlHook) => {
    if (node instanceof Y.XmlText) {
      for (const op of node.toDelta() as {
        insert: string
        attributes?: Record<string, { href: string }>
      }[])
        if (op.attributes?.hyperlink) out.push(`${op.insert}->${op.attributes.hyperlink.href}`)
    } else if (!(node instanceof Y.XmlHook)) node.toArray().forEach(walk)
  }
  walk(ydoc.getXmlFragment('default'))
  return out
}

const undoManagerOf = (editor: Editor): Y.UndoManager =>
  (yUndoPluginKey.getState(editor.state) as { undoManager: Y.UndoManager }).undoManager

const LINKED = 'see [example.com](https://example.com) '

it('runs with the y-sync key that docs.plus has', () => {
  expect((ySyncPluginKey as unknown as { key: string }).key).toBe('y-sync$1')
})

describe('a peer does not autolink what another peer wrote (#771)', () => {
  function unlinkThenPeerTypes(extra: Extension[] = []) {
    const { A, B, da } = pair(extra)
    typeAt(B, 1, 'see example.com ')
    expect(show(A)).toBe(LINKED)
    selectAll(B)
    B.commands.unsetHyperlink()
    expect(show(A)).toBe('see example.com ')
    typeAt(A, 1, 'Z')
    expect([show(A), show(B)]).toEqual(['Zsee example.com ', 'Zsee example.com '])
    expect(yLinks(da)).toEqual([])
  }

  it('a removed link stays removed after the other peer types', () => unlinkThenPeerTypes())

  it('the same holds when another plugin answers the peer change first', () =>
    unlinkThenPeerTypes([StampOnPeerChange]))

  it('a peer bold across two blocks does not link the text on the other peer', () => {
    const { A, B, da } = pair()
    typeAt(B, 1, 'see example.com')
    B.commands.splitBlock()
    type(B, 'next')
    // Enter linked the URL on B; remove it so only a relink can bring it back.
    selectAll(B)
    B.commands.unsetHyperlink()
    expect(show(A)).toBe('see example.com | next')
    A.commands.setTextSelection({ from: 2, to: end(A) - 1 })
    A.commands.setMark('bold')
    expect(show(B)).not.toContain('](')
    typeAt(B, end(B), '!')
    expect(show(A)).toBe(show(B))
    expect(yLinks(da)).toEqual([])
  })

  function loadsWithoutLinks(mountFirst: boolean) {
    const da = new Y.Doc()
    const A = peer(da)
    typeAt(A, 1, 'see example.com')
    A.commands.splitBlock()
    type(A, 'next')
    selectAll(A)
    A.commands.unsetHyperlink()
    const dc = new Y.Doc()
    let C: Editor
    if (mountFirst) {
      C = peer(dc)
      connect(da, dc)
    } else {
      connect(da, dc)
      C = peer(dc)
    }
    expect(show(C)).toBe('see example.com | next')
    typeAt(C, end(C), '!')
    expect(yLinks(da)).toEqual([])
  }

  it('a peer that joins a loaded pad does not link the first block', () => loadsWithoutLinks(false))

  it('a peer that mounts before its first sync does not link the first block', () =>
    loadsWithoutLinks(true))
})

describe('autolink still links what this peer types', () => {
  it('local typing links, and the peer and the Y.Doc get the link', () => {
    const { A, B, da } = pair()
    typeAt(A, 1, 'hi example.com ')
    expect([show(A), show(B)]).toEqual([
      'hi [example.com](https://example.com) ',
      'hi [example.com](https://example.com) '
    ])
    expect(yLinks(da)).toEqual(['example.com->https://example.com'])
  })

  it('both peers type on each side of a link at once', () => {
    const { A, B, da, net } = pair()
    typeAt(A, 1, 'see example.com end')
    net.hold()
    typeAt(A, 16, 'X')
    typeAt(B, 5, 'Y')
    net.flush()
    expect(show(A)).toBe('see Y[example.com](https://example.com)X end')
    expect(show(B)).toBe(show(A))
    expect(yLinks(da)).toEqual(['example.com->https://example.com'])
  })

  it('one peer removes a link while the other types in the same block', () => {
    const { A, B, da, net } = pair()
    typeAt(A, 1, 'see example.com end')
    net.hold()
    selectAll(B)
    B.commands.unsetHyperlink()
    typeAt(A, 1, 'Z')
    net.flush()
    typeAt(A, end(A), '1')
    expect([show(A), show(B)]).toEqual(['Zsee example.com end1', 'Zsee example.com end1'])
    expect(yLinks(da)).toEqual([])
  })

  it('one peer breaks the URL while the other types inside the link', () => {
    const { A, B, da, net } = pair()
    typeAt(A, 1, 'see example.com end')
    net.hold()
    A.view.dispatch(A.state.tr.delete(12, 16))
    typeAt(B, 8, 'Q')
    net.flush()
    expect(show(A)).toBe(show(B))
    expect(yLinks(da)).toEqual([])
  })
})

describe('y-undo', () => {
  it('undo removes the link the space made, and redo brings it back', () => {
    const { A, B } = pair()
    const um = undoManagerOf(A)
    typeAt(A, 1, 'see example.com')
    um.stopCapturing()
    type(A, ' ')
    um.stopCapturing()
    A.commands.undo()
    expect([show(A), show(B)]).toEqual(['see example.com', 'see example.com'])
    A.commands.redo()
    expect([show(A), show(B)]).toEqual([LINKED, LINKED])
  })

  it('undo of Remove link brings the link back on both peers', () => {
    const { A, B } = pair()
    const um = undoManagerOf(A)
    typeAt(A, 1, 'see example.com ')
    um.stopCapturing()
    selectAll(A)
    A.commands.unsetHyperlink()
    um.stopCapturing()
    A.commands.undo()
    expect([show(A), show(B)]).toEqual([LINKED, LINKED])
  })

  // The undoing peer links at once. y-tiptap does not write a mark added after a Y change back to
  // the Y.Doc, so the other peer gets the link on the undoing peer's next transaction.
  it('an undo that brings back the space after a URL links on the undoing peer', () => {
    const { A, B, da } = pair()
    const um = undoManagerOf(A)
    A.view.dispatch(A.state.tr.insertText('see example.com x', 1))
    um.stopCapturing()
    A.view.dispatch(A.state.tr.delete(end(A) - 1, end(A)))
    um.stopCapturing()
    A.view.dispatch(A.state.tr.delete(end(A) - 1, end(A)))
    um.stopCapturing()
    expect(show(A)).toBe('see example.com')
    A.commands.undo()
    expect([show(A), show(B)]).toEqual([LINKED, 'see example.com '])
    expect(yLinks(da)).toEqual([])
    A.commands.setTextSelection(1)
    expect([show(A), show(B)]).toEqual([LINKED, LINKED])
    expect(yLinks(da)).toEqual(['example.com->https://example.com'])
  })
})

// y-tiptap scrolls a Y change only with a focused view whose DOM selection is in view. The DOM
// stub here never meets that, so these set the scroll by hand, as a real browser does.
describe('a one-chunk insert that y-sync writes takes no chunk path (#780)', () => {
  const chunk = (editor: Editor, meta: { isChangeOrigin: boolean; isUndoRedoOperation: boolean }) =>
    editor.view.dispatch(
      editor.state.tr
        .insertText('see example.com now', 1)
        .setMeta(ySyncPluginKey, meta)
        .scrollIntoView()
    )

  it('a peer insert is not linked', () => {
    const { A } = pair()
    chunk(A, { isChangeOrigin: true, isUndoRedoOperation: false })
    expect(show(A)).toBe('see example.com now')
  })

  it('a y-undo insert is not linked', () => {
    const { A } = pair()
    chunk(A, { isChangeOrigin: true, isUndoRedoOperation: true })
    expect(show(A)).toBe('see example.com now')
  })

  it('a local chunk links, and the peer gets the link', () => {
    const { A, B } = pair()
    A.view.dispatch(A.state.tr.insertText('see example.com now', 1).scrollIntoView())
    expect([show(A), show(B)]).toEqual([
      'see [example.com](https://example.com) now',
      'see [example.com](https://example.com) now'
    ])
  })
})
