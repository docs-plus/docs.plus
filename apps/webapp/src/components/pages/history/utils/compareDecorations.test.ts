import { schema } from '@tiptap/pm/schema-basic'

import { buildCompareDecorations } from './compareDecorations'

/** One paragraph from mixed inline pieces; a bare string becomes an unmarked text node. */
const para = (...pieces: (string | object)[]) => ({
  type: 'paragraph',
  content: pieces.map((piece) =>
    typeof piece === 'string' ? { type: 'text', text: piece } : piece
  )
})

const doc = (...paragraphs: string[]) => ({
  type: 'doc',
  content: paragraphs.map((text) => ({
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : []
  }))
})

// A widget decoration collapses to a point; an inline one spans a range.
const isWidget = (d: { from: number; to: number }) => d.from === d.to
const isInline = (d: { from: number; to: number }) => d.to > d.from

const decorationsOf = (result: ReturnType<typeof buildCompareDecorations>) => {
  if ('error' in result) throw new Error(`expected decorations, got ${result.error}`)
  return result.decorations
}

describe('buildCompareDecorations', () => {
  it('marks inserted text inline', () => {
    const decorations = decorationsOf(
      buildCompareDecorations(schema, doc('one two'), doc('one two three'))
    )
    expect(decorations.length).toBeGreaterThan(0)
    expect(decorations.every(isInline)).toBe(true)
  })

  it('marks removed text with a widget', () => {
    // No "and no inline": simplifyChanges expands to word boundaries and can leave a
    // non-empty B-side span on a pure deletion.
    const decorations = decorationsOf(
      buildCompareDecorations(schema, doc('one two three'), doc('one two'))
    )
    expect(decorations.some(isWidget)).toBe(true)
  })

  it('marks both sides of a replacement', () => {
    const decorations = decorationsOf(
      buildCompareDecorations(schema, doc('the quick fox'), doc('the slow fox'))
    )
    expect(decorations.some(isInline)).toBe(true)
    expect(decorations.some(isWidget)).toBe(true)
  })

  // The default token encoder keys a character on its code and a node on its type name,
  // so every case below reported zero decorations before diffTokenEncoder.ts landed.
  it('marks text that only gained a mark', () => {
    const plain = { type: 'doc', content: [para('hello world')] }
    const bolded = {
      type: 'doc',
      content: [para('hello ', { type: 'text', text: 'world', marks: [{ type: 'strong' }] })]
    }
    expect(decorationsOf(buildCompareDecorations(schema, plain, bolded)).length).toBeGreaterThan(0)
  })

  it('marks a link whose href changed but whose text did not', () => {
    const linked = (href: string) => ({
      type: 'doc',
      content: [
        para({ type: 'text', text: 'the docs', marks: [{ type: 'link', attrs: { href } }] })
      ]
    })
    expect(
      decorationsOf(
        buildCompareDecorations(schema, linked('https://a.example'), linked('https://b.example'))
      ).length
    ).toBeGreaterThan(0)
  })

  it('marks a heading whose level changed but whose text did not', () => {
    const heading = (level: number) => ({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level }, content: [{ type: 'text', text: 'Section' }] }]
    })
    expect(decorationsOf(buildCompareDecorations(schema, heading(2), heading(3))).length).toBe(1)
  })

  it('ignores a toc-id rewrite, which the first browser open performs', () => {
    // `prosemirror-schema-basic` drops an unknown attr, so both sides decode identically.
    // The real webapp schema declares toc-id, and diffTokenEncoder strips it by name.
    const stamped = (id: string) => ({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, 'toc-id': id },
          content: [{ type: 'text', text: 'Section' }]
        }
      ]
    })
    expect(decorationsOf(buildCompareDecorations(schema, stamped('aaa'), stamped('zzz')))).toEqual(
      []
    )
  })

  it('reports undecodable content instead of throwing', () => {
    const result = buildCompareDecorations(
      schema,
      { type: 'doc', content: [{ type: 'not_a_real_node' }] },
      doc('one')
    )
    expect(result).toEqual({ error: 'undecodable' })
  })
})
