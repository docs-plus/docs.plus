import { describe, expect, test } from 'bun:test'

import type { TiptapDocJson } from '../../../document-content/types'
import { pairSections } from '../../domain/pairSections'
import { blockText } from '../../../../lib/blockText'
import { segmentSections } from '../../domain/segmentSections'
import { doc, heading, para, text } from '../fixtures'

const shape = (before: TiptapDocJson, after: TiptapDocJson) =>
  pairSections(segmentSections(before), segmentSections(after)).map((pair) => ({
    baseline: pair.baseline?.headingText ?? null,
    head: pair.head?.headingText ?? null
  }))

/** Same-named headings are told apart by their bodies, not their titles. */
const bodies = (before: TiptapDocJson, after: TiptapDocJson) =>
  pairSections(segmentSections(before), segmentSections(after)).map((pair) => ({
    baseline: pair.baseline ? blockText(pair.baseline.nodes, ' ') : null,
    head: pair.head ? blockText(pair.head.nodes, ' ') : null
  }))

describe('pairSections', () => {
  test('names the deleted title once, and never reports a heading as two rows', () => {
    // The positional title rule paired first-with-first, shifting every later
    // section up by one: the API then called B modified and C removed, and never
    // mentioned the title that actually went.
    expect(
      shape(
        doc(heading(1, 'Title', 't1'), heading(2, 'B', 'b1'), heading(2, 'C', 'c1')),
        doc(heading(2, 'B', 'b1'), heading(2, 'C', 'c1'))
      )
    ).toEqual([
      { baseline: 'Title', head: null },
      { baseline: 'B', head: 'B' },
      { baseline: 'C', head: 'C' }
    ])
  })

  test('reads a heading inserted above the title as one addition', () => {
    expect(
      shape(
        doc(heading(1, 'Title', 't1'), heading(2, 'B', 'b1')),
        doc(heading(1, 'New', 'n1'), heading(1, 'Title', 't1'), heading(2, 'B', 'b1'))
      )
    ).toEqual([
      { baseline: null, head: 'New' },
      { baseline: 'Title', head: 'Title' },
      { baseline: 'B', head: 'B' }
    ])
  })

  test('reads a front insertion among same-named unstamped headings as one addition', () => {
    // Pairing leftovers by (level, heading text) is positional when the names
    // repeat, so it matched each body with its predecessor: one insertion then
    // reported three sections as modified. LCS anchors on the bodies instead.
    const note = (body: string) => [heading(2, 'Notes'), para(text(body))]
    expect(
      bodies(
        doc(...note('alpha'), ...note('beta'), ...note('gamma')),
        doc(...note('new'), ...note('alpha'), ...note('beta'), ...note('gamma'))
      )
    ).toEqual([
      { baseline: null, head: 'new' },
      { baseline: 'alpha', head: 'alpha' },
      { baseline: 'beta', head: 'beta' },
      { baseline: 'gamma', head: 'gamma' }
    ])
  })

  test('a far deletion and a far addition stay two events', () => {
    // Both leftovers carry a stable toc-id and are unrelated, but compaction made
    // them adjacent in the leftover arrays. Zipping them hid the deletion entirely
    // and reported the brand-new section as an edit to the one that went.
    expect(
      shape(
        doc(heading(1, 'Title', 't1'), heading(2, 'A', 'a1'), heading(2, 'B', 'b1')),
        doc(heading(1, 'Title', 't1'), heading(2, 'B', 'b1'), heading(2, 'D', 'd1'))
      )
    ).toEqual([
      { baseline: 'Title', head: 'Title' },
      { baseline: 'A', head: null },
      { baseline: 'B', head: 'B' },
      { baseline: null, head: 'D' }
    ])
  })

  test('a stable toc-id beats document position when a section moves', () => {
    expect(
      shape(
        doc(heading(1, 'A', 'a1'), heading(1, 'B', 'b1')),
        doc(heading(1, 'B', 'b1'), heading(1, 'A', 'a1'))
      )
    ).toEqual([
      { baseline: 'B', head: 'B' },
      { baseline: 'A', head: 'A' }
    ])
  })

  test('a duplicate toc-id inside one snapshot pairs the first and drops the second', () => {
    const pairs = shape(
      doc(heading(1, 'A', 'dup'), heading(1, 'B', 'dup')),
      doc(heading(1, 'A', 'dup'))
    )
    expect(pairs).toEqual([
      { baseline: 'A', head: 'A' },
      { baseline: 'B', head: null }
    ])
  })
})
