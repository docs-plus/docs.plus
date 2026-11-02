import type { JSONContent } from '@tiptap/core'

import { carryHeadingIds } from './carryHeadingIds'

const heading = (level: number, text: string, id?: string): JSONContent => ({
  type: 'heading',
  attrs: { level, ...(id ? { 'toc-id': id } : {}) },
  content: [{ type: 'text', text }]
})

const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

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

  it('leaves a heading with a new level without an id', () => {
    const result = carryHeadingIds(doc(heading(2, 'Same', 'a')), doc(heading(3, 'Same')))
    expect(idsOf(result)).toEqual([null])
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
})
