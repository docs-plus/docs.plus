import { getSchema } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { EditorState } from '@tiptap/pm/state'

import { transactionAffectsNodeType } from './transaction-affects-node-type'

const schema = getSchema([Document, Paragraph, Text, Heading])

type Block = [level: number, text: string] | string

// `[2, 'H']` is an H2 with text "H"; a bare string is a paragraph.
const makeDoc = (...blocks: Block[]) =>
  schema.nodeFromJSON({
    type: 'doc',
    content: blocks.map((b) =>
      typeof b === 'string'
        ? { type: 'paragraph', content: [{ type: 'text', text: b }] }
        : { type: 'heading', attrs: { level: b[0] }, content: [{ type: 'text', text: b[1] }] }
    )
  })

const trFor = (...blocks: Block[]) => EditorState.create({ doc: makeDoc(...blocks) }).tr
const affects = (tr: ReturnType<typeof trFor>) => transactionAffectsNodeType(tr, 'heading')

describe('transactionAffectsNodeType', () => {
  it('sees a heading inserted in one step', () => {
    const tr = trFor('aaaa')
    tr.insert(0, schema.nodes.heading.create({ level: 2 }, schema.text('H')))
    expect(affects(tr)).toBe(true)
  })

  it('sees a heading deleted in one step', () => {
    // p "aaaa" is 0–6, h "H" is 6–9.
    const tr = trFor('aaaa', [2, 'H'], 'bbbb')
    tr.delete(6, 9)
    expect(affects(tr)).toBe(true)
  })

  it('ignores a one-step paragraph edit', () => {
    const tr = trFor('aaaa', [2, 'H'], 'bbbb')
    tr.delete(1, 3)
    expect(affects(tr)).toBe(false)
  })

  // Step 2's range 0–3 is the heading in tr.docs[1], but the first paragraph in tr.before.
  it('sees a heading deleted by a later step', () => {
    const tr = trFor('aaaa', [2, 'H'], 'bbbb')
    tr.delete(0, 6)
    tr.delete(0, 3)
    expect(tr.steps).toHaveLength(2)
    expect(affects(tr)).toBe(true)
  })

  // Step 2's range 1–3 is inside the new paragraph, but inside the heading in tr.before.
  it('ignores a later paragraph edit that overlaps a heading in tr.before', () => {
    const tr = trFor([2, 'H'], 'aaaa')
    tr.insert(0, schema.nodes.paragraph.create(null, schema.text('xxxx')))
    tr.delete(1, 3)
    expect(tr.steps).toHaveLength(2)
    expect(affects(tr)).toBe(false)
  })
})
