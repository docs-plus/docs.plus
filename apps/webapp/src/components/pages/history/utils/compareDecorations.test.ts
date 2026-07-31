import { schema } from '@tiptap/pm/schema-basic'

import { buildCompareDecorations } from './compareDecorations'

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

  it('reports undecodable content instead of throwing', () => {
    const result = buildCompareDecorations(
      schema,
      { type: 'doc', content: [{ type: 'not_a_real_node' }] },
      doc('one')
    )
    expect(result).toEqual({ error: 'undecodable' })
  })
})
