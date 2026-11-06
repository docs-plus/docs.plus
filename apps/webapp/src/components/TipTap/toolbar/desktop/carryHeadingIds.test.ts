import type { JSONContent } from '@tiptap/core'

import { carryHeadingIds, headingRecords, pickHeadingIds } from './carryHeadingIds'

const heading = (level: number, text: string, id?: string): JSONContent => ({
  type: 'heading',
  attrs: { level, ...(id ? { 'toc-id': id } : {}) },
  content: [{ type: 'text', text }]
})

const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }]
})

const idsOf = (result: JSONContent) =>
  (result.content ?? []).map((node) => node.attrs?.['toc-id'] ?? null)

describe('carryHeadingIds', () => {
  it('keeps the id of a heading with the same level and text', () => {
    const result = carryHeadingIds(
      doc(heading(1, 'Title', 'a'), heading(2, 'Kept', 'b')),
      doc(heading(1, 'Title'), { type: 'paragraph' }, heading(2, 'Kept'))
    )
    expect(idsOf(result)).toEqual(['a', null, 'b'])
  })

  it('leaves a renamed heading without an id', () => {
    const result = carryHeadingIds(doc(heading(2, 'Old', 'a')), doc(heading(2, 'New')))
    expect(idsOf(result)).toEqual([null])
  })

  it('keeps the id of a heading whose level changed', () => {
    const result = carryHeadingIds(
      doc(heading(1, 'Title', 't'), heading(2, 'Same', 'a'), heading(3, 'Child', 'b')),
      doc(heading(1, 'Title'), heading(1, 'Group'), heading(3, 'Same'), heading(4, 'Child'))
    )
    expect(idsOf(result)).toEqual(['t', null, 'a', 'b'])
  })

  it('gives each old id once, in document order, for repeated headings', () => {
    const result = carryHeadingIds(
      doc(heading(2, 'Notes', 'a'), heading(2, 'Notes', 'b')),
      doc(heading(2, 'Notes'), heading(2, 'Notes'), heading(2, 'Notes'))
    )
    expect(idsOf(result)).toEqual(['a', 'b', null])
  })

  it('compares the whole heading text across marks', () => {
    const marked: JSONContent = {
      type: 'heading',
      attrs: { level: 2 },
      content: [
        { type: 'text', text: 'Bold ', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'title' }
      ]
    }
    const result = carryHeadingIds(doc(heading(2, 'Bold title', 'a')), doc(marked))
    expect(idsOf(result)).toEqual(['a'])
  })

  // The shipped pool gave ids in document order, so swapped sections took each other's.
  it('keeps the ids of repeated sub-headings when their sections swap', () => {
    const result = carryHeadingIds(
      doc(
        heading(1, 'Alpha', 'a'),
        heading(2, 'Notes', 'a-notes'),
        heading(2, 'Plan', 'a-plan'),
        heading(1, 'Beta', 'b'),
        heading(2, 'Notes', 'b-notes'),
        heading(2, 'Plan', 'b-plan')
      ),
      doc(
        heading(1, 'Beta'),
        heading(2, 'Notes'),
        heading(2, 'Plan'),
        heading(1, 'Alpha'),
        heading(2, 'Notes'),
        heading(2, 'Plan')
      )
    )
    expect(idsOf(result)).toEqual(['b', 'b-notes', 'b-plan', 'a', 'a-notes', 'a-plan'])
  })

  it('breaks a tie between repeated headings by their section text', () => {
    const result = carryHeadingIds(
      doc(
        heading(2, 'Notes', 'a'),
        paragraph('first'),
        heading(2, 'Notes', 'b'),
        paragraph('second')
      ),
      doc(heading(3, 'Notes'), paragraph('second'), heading(3, 'Notes'), paragraph('first'))
    )
    expect(idsOf(result)).toEqual(['b', null, 'a', null])
  })

  it('keeps the id of a renamed heading whose section text is unique and unchanged', () => {
    const result = carryHeadingIds(
      doc(heading(2, 'Budget', 'a'), paragraph('Spend  less\nin  May.')),
      doc(heading(3, 'Costs'), paragraph('Spend less in May.'))
    )
    expect(idsOf(result)).toEqual(['a', null])
  })

  it('leaves a renamed heading without an id when its section text is not unique', () => {
    const result = carryHeadingIds(
      doc(heading(2, 'One', 'a'), paragraph('Same'), heading(2, 'Two', 'b'), paragraph('Same')),
      doc(heading(2, 'Uno'), paragraph('Same'), heading(2, 'Dos'), paragraph('Same'))
    )
    expect(idsOf(result)).toEqual([null, null, null, null])
  })

  it('never matches an empty heading by its title', () => {
    const empty: JSONContent = { type: 'heading', attrs: { level: 2 } }
    const result = carryHeadingIds(
      doc({ ...empty, attrs: { level: 2, 'toc-id': 'a' } }, heading(2, 'Kept', 'b')),
      doc(empty, heading(2, 'Kept'))
    )
    expect(idsOf(result)).toEqual([null, 'b'])
  })

  it('drops an incoming id that the old document does not hold', () => {
    const result = carryHeadingIds(doc(heading(2, 'Old', 'a')), doc(heading(2, 'New', 'zzz')))
    expect(idsOf(result)).toEqual([null])
  })

  it('takes a preferred id first, only from the old set, and only once', () => {
    const old = headingRecords(doc(heading(2, 'Alpha', 'a'), heading(2, 'Beta', 'b')))
    const incoming = headingRecords(
      doc(heading(2, 'Beta'), heading(2, 'Alpha'), heading(2, 'Gamma'), heading(2, 'Delta'))
    ).map((record, i) => ({ ...record, preferredId: ['a', 'a', 'x', null][i] }))
    expect(pickHeadingIds(old, incoming)).toEqual(['a', null, null, null])
  })

  // The pad-wide chat room uses the documentId as its heading_id, so no heading may hold it.
  it('never gives an old heading the documentId as its id', () => {
    const result = carryHeadingIds(
      doc(heading(1, 'Title', 'doc-1'), heading(2, 'Kept', 'b')),
      doc(heading(1, 'Title'), heading(2, 'Kept')),
      'doc-1'
    )
    expect(idsOf(result)).toEqual([null, 'b'])
  })

  it('never keeps a preferred id equal to the documentId', () => {
    const old = headingRecords(doc(heading(2, 'Alpha', 'doc-1'), heading(2, 'Beta', 'b')))
    const incoming = headingRecords(doc(heading(2, 'Alpha'), heading(2, 'Beta'))).map(
      (record, i) => ({ ...record, preferredId: ['doc-1', 'b'][i] })
    )
    expect(pickHeadingIds(old, incoming, 'doc-1')).toEqual([null, 'b'])
  })
})
