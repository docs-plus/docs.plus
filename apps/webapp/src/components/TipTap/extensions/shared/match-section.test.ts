import { getSchema } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

import { filterSections, findAllSections, matchSections } from './match-section'

// Heading needs a `toc-id` attr (the section identity the filter keys on).
const HeadingWithTocId = Heading.extend({
  addAttributes() {
    return { ...this.parent?.(), 'toc-id': { default: null } }
  }
})

const schema = getSchema([Document, Paragraph, Text, HeadingWithTocId])

const h = (level: number, tocId: string, text: string) => ({
  type: 'heading',
  attrs: { level, 'toc-id': tocId },
  content: [{ type: 'text', text }]
})
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

// H1 Title | H2 fruit("apple pie") > H3 fruit-sweet("banana split") | H2 veg("apple carrot")
const makeDoc = () =>
  schema.nodeFromJSON({
    type: 'doc',
    content: [
      h(1, 'title', 'Title'),
      h(2, 'fruit', 'Fruit'),
      p('apple pie'),
      h(3, 'fruit-sweet', 'Sweet'),
      p('banana split'),
      h(2, 'veg', 'Veggies'),
      p('apple carrot')
    ]
  })

const ids = (r: { matchedIds: Set<string> }) => [...r.matchedIds].sort()

describe('match-section engine', () => {
  it('excludes the H1 title section and counts only body sections', () => {
    expect(
      findAllSections(makeDoc())
        .map((s) => s.id)
        .sort()
    ).toEqual(['fruit', 'fruit-sweet', 'veg'])
    expect(filterSections(makeDoc(), ['apple'], 'or').totalSections).toBe(3)
  })

  it('OR pulls a descendant in when its parent matches', () => {
    // "apple" hits fruit + veg directly; fruit-sweet (h3 under fruit) joins as descendant
    expect(ids(filterSections(makeDoc(), ['apple'], 'or'))).toEqual(['fruit', 'fruit-sweet', 'veg'])
  })

  it('OR pulls an ancestor in when its child matches', () => {
    // "banana" hits fruit-sweet directly; its h2 ancestor fruit joins
    expect(ids(filterSections(makeDoc(), ['banana'], 'or'))).toEqual(['fruit', 'fruit-sweet'])
  })

  it('AND requires every term in the same section body', () => {
    expect(ids(filterSections(makeDoc(), ['apple', 'banana'], 'and'))).toEqual([])
    expect(ids(filterSections(makeDoc(), ['apple', 'carrot'], 'and'))).toEqual(['veg'])
  })

  it('matches case-insensitively', () => {
    expect(ids(filterSections(makeDoc(), ['APPLE'], 'or'))).toEqual(
      ids(filterSections(makeDoc(), ['apple'], 'or'))
    )
  })

  it('empty slugs means show everything', () => {
    expect(ids(filterSections(makeDoc(), [], 'or'))).toEqual(['fruit', 'fruit-sweet', 'veg'])
  })

  it('matchSections returns only direct body hits (no ancestor/descendant expansion)', () => {
    expect(
      matchSections(makeDoc(), 'apple')
        .map((m) => m.section.id)
        .sort()
    ).toEqual(['fruit', 'veg'])
  })

  it('honours a precomputed sections list (perf path) without changing results', () => {
    const doc = makeDoc()
    const sections = findAllSections(doc)
    const perQueryMatches = new Map([['apple', matchSections(doc, 'apple', sections)]])
    expect(ids(filterSections(doc, ['apple'], 'or', { sections, perQueryMatches }))).toEqual(
      ids(filterSections(makeDoc(), ['apple'], 'or'))
    )
  })
})
