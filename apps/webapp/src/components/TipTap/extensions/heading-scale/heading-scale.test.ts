import { getSchema } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import type { Decoration, DecorationSet } from '@tiptap/pm/view'

import { HeadingScale, headingScalePluginKey } from './heading-scale'

const schema = getSchema([Document, Paragraph, Text, Heading])
const [plugin] = HeadingScale.config.addProseMirrorPlugins!.call({} as never)

const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }]
})
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

const makeState = (content: object[]) =>
  EditorState.create({ doc: schema.nodeFromJSON({ type: 'doc', content }), plugins: [plugin] })

// `style` sits on the internal decoration type, not in the public typings.
const sizeAt = (set: DecorationSet, doc: PMNode, pos: number) => {
  const end = pos + doc.nodeAt(pos)!.nodeSize
  const own = set.find(pos, end).filter((d: Decoration) => d.from === pos && d.to === end)
  const styles = own.map(
    (d) => (d as Decoration & { type: { attrs: { style: string } } }).type.attrs.style
  )
  return styles.map((s) => s.match(/--hd-size: ([\d.]+)pt/)?.[1])
}

const sizesOf = (state: EditorState, set = headingScalePluginKey.getState(state)!.decorations) => {
  const sizes: (string | undefined)[][] = []
  state.doc.forEach((_node, offset) => sizes.push(sizeAt(set, state.doc, offset)))
  return sizes
}

describe('heading-scale decorations', () => {
  // A Yjs change (remote, undo, redo) reaches the editor as this replace. Mapping drops every
  // decoration, so the plugin must rebuild or every heading loses its size.
  it('keeps a size on every heading after a whole-document replace', () => {
    const state = makeState([h(1, 'Title'), h(2, 'A'), p('a'), h(3, 'a1'), h(2, 'B'), h(3, 'b1')])
    const next = state.apply(state.tr.replaceWith(0, state.doc.content.size, state.doc.content))
    const fresh = plugin.spec.state!.init({}, next).decorations
    expect(sizesOf(next)).toEqual(sizesOf(next, fresh))
    expect(sizesOf(next)).toEqual([[], ['22'], [], ['12'], ['22'], ['12']])
  })

  it('gives the title no rank and spaces six ranks 2pt apart', () => {
    // Section 1 is the lone h2 after the title; the h1 starts a six-rank section 2.
    const state = makeState([
      h(1, 'T'),
      h(2, 'I'),
      h(1, '1'),
      h(2, '2'),
      h(3, '3'),
      h(4, '4'),
      h(5, '5'),
      h(6, '6')
    ])
    expect(sizesOf(state)).toEqual([[], ['22'], ['22'], ['20'], ['18'], ['16'], ['14'], ['12']])
  })
})
