import { describe, expect, test } from 'bun:test'
import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { migrationExtensions } from '../../../lib/migration-extensions'
import { doc, heading, para, text } from '../../document-changes/__tests__/fixtures'
import { computeVersionChangeSummary } from '../domain/versionChangeSummary'

const snapshot = (document: ReturnType<typeof doc>): Uint8Array =>
  Y.encodeStateAsUpdate(TiptapTransformer.toYdoc(document, 'default', migrationExtensions))

const zero = {
  sectionsAdded: 0,
  sectionsRemoved: 0,
  sectionsModified: 0,
  sectionsMoved: 0,
  wordsAdded: 0,
  wordsRemoved: 0
}

const cases = [
  {
    name: 'one added section',
    before: doc(heading(1, 'Title', 't1')),
    after: doc(heading(1, 'Title', 't1'), heading(2, 'New', 'n1'), para(text('a b c'))),
    counts: { sectionsAdded: 1, wordsAdded: 4 }
  },
  {
    name: 'one removed section',
    before: doc(heading(1, 'Title', 't1'), heading(2, 'Old', 'o1'), para(text('a b'))),
    after: doc(heading(1, 'Title', 't1')),
    counts: { sectionsRemoved: 1, wordsRemoved: 3 }
  },
  {
    name: 'one changed section',
    before: doc(heading(1, 'Title', 't1'), para(text('one two three'))),
    after: doc(heading(1, 'Title', 't1'), para(text('one two three four'))),
    counts: { sectionsModified: 1, wordsAdded: 1 }
  },
  {
    name: 'one moved section',
    before: doc(heading(1, 'Title', 't1'), heading(2, 'A', 'a1'), heading(2, 'B', 'b1')),
    after: doc(heading(1, 'Title', 't1'), heading(2, 'B', 'b1'), heading(2, 'A', 'a1')),
    counts: { sectionsMoved: 1 }
  }
]

describe('computeVersionChangeSummary', () => {
  for (const { name, before, after, counts } of cases) {
    test(name, () => {
      const summary = computeVersionChangeSummary(snapshot(after), snapshot(before), () => {})
      expect(summary).toEqual({ v: 1, title: 'Title', ...zero, ...counts })
    })
  }

  // Two encodes of one doc differ by client id, so only the same bytes reach the shortcut.
  test('byte-equal snapshots change nothing', () => {
    const head = snapshot(doc(heading(1, 'Title', 't1'), para(text('body'))))
    const summary = computeVersionChangeSummary(head, Uint8Array.from(head), () => {})
    expect(summary).toEqual({ v: 1, title: 'Title', ...zero })
  })
})
