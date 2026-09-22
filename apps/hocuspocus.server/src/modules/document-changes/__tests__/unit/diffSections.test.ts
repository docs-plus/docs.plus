import { describe, expect, test } from 'bun:test'

import type { TiptapDocJson } from '../../../document-content/types'
import { diffSections } from '../../domain/diffSections'
import { movedTocIds, pairSections } from '../../domain/pairSections'
import { segmentSections } from '../../domain/segmentSections'
import { EXCERPT_MAX_CHARS } from '../../types'
import { BOLD, doc, heading, link, para, text } from '../fixtures'

const changesOf = (before: TiptapDocJson, after: TiptapDocJson) => {
  const baseline = segmentSections(before)
  const pairs = pairSections(baseline, segmentSections(after))
  return diffSections(pairs, undefined, movedTocIds(baseline, pairs))
}

// The changeset's default token encoder keys a character on its code and a node
// on its type name, so it reads neither marks nor attributes. Each edit below is
// real, deep-compares as different, and then reports zero changes to quantify.
// Reclassifying any of them as unchanged drops a real edit from the digest.
describe('diffSections — a formatting edit is modified with no magnitude', () => {
  const cases: [string, TiptapDocJson, TiptapDocJson][] = [
    [
      'bold added to existing words',
      doc(heading(1, 'Title', 't1'), para(text('hello world'))),
      doc(heading(1, 'Title', 't1'), para(text('hello '), text('world', BOLD)))
    ],
    [
      'a changed link address under unchanged words',
      doc(heading(1, 'Title', 't1'), para(text('the docs', link('https://a.example')))),
      doc(heading(1, 'Title', 't1'), para(text('the docs', link('https://b.example'))))
    ],
    [
      'a heading moved from level 2 to level 3',
      doc(heading(1, 'Title', 't1'), heading(2, 'Section', 's1'), para(text('body'))),
      doc(heading(1, 'Title', 't1'), heading(3, 'Section', 's1'), para(text('body')))
    ]
  ]

  for (const [name, before, after] of cases) {
    test(name, () => {
      const changed = changesOf(before, after).filter((s) => s.status !== 'unchanged')
      expect(changed).toHaveLength(1)
      expect(changed[0].status).toBe('modified')
      expect(changed[0].magnitude).toBeNull()
    })
  }
})

describe('diffSections', () => {
  test('a toc-id rewrite is unchanged, which the first browser open performs', () => {
    const stamped = (id: string) => doc(heading(1, 'Title', id), para(text('body')))
    expect(changesOf(stamped('aaa'), stamped('zzz')).map((s) => s.status)).toEqual(['unchanged'])
  })

  test('counts the words an edit really added', () => {
    const [section] = changesOf(
      doc(heading(1, 'Title', 't1'), para(text('one two three'))),
      doc(heading(1, 'Title', 't1'), para(text('one two three')), para(text('four five six seven')))
    )
    expect(section.status).toBe('modified')
    expect(section.magnitude).toEqual({
      wordsAdded: 4,
      wordsRemoved: 0,
      blocksBefore: 2,
      blocksAfter: 3
    })
  })

  test('an added section counts every word it brought', () => {
    const added = changesOf(
      doc(heading(1, 'Title', 't1')),
      doc(heading(1, 'Title', 't1'), heading(2, 'New', 'n1'), para(text('a b c')))
    ).find((s) => s.status === 'added')
    expect(added?.magnitude).toEqual({
      wordsAdded: 4,
      wordsRemoved: 0,
      blocksBefore: 0,
      blocksAfter: 2
    })
  })

  test('a removed section counts whole', () => {
    const removed = changesOf(
      doc(heading(1, 'Title', 't1'), heading(2, 'Old', 'o1'), para(text('a b'))),
      doc(heading(1, 'Title', 't1'))
    ).find((s) => s.status === 'removed')
    expect(removed?.magnitude?.wordsRemoved).toBe(3)
    expect(removed?.magnitude?.blocksAfter).toBe(0)
  })

  test('strips a newline from the excerpt, which would forge a line in a plain-text email', () => {
    const [section] = changesOf(
      doc(heading(1, 'Title', 't1'), para(text('body'))),
      doc(heading(1, 'Title', 't1'), para(text('body')), para(text('real\nForged entry')))
    )
    expect(section.excerpt).toBe('real Forged entry')
  })

  test('a changed sentence keeps the new words and the old words', () => {
    const [section] = changesOf(
      doc(heading(1, 'Title', 't1'), para(text('Hello alpha'))),
      doc(heading(1, 'Title', 't1'), para(text('Hello beta')))
    ).filter((row) => row.status === 'modified')
    expect(section.excerpt).toBe('beta')
    expect(section.removedExcerpt).toBe('alpha')
    expect(section.runs).toEqual([
      { kind: 'same', text: 'Hello ' },
      { kind: 'removed', text: 'alpha' },
      { kind: 'added', text: 'beta' }
    ])
  })

  test('a pure reorder is moved', () => {
    const changes = changesOf(
      doc(heading(1, 'A', 'a1'), heading(1, 'B', 'b1')),
      doc(heading(1, 'B', 'b1'), heading(1, 'A', 'a1'))
    )
    expect(changes.find((section) => section.text === 'A')?.status).toBe('moved')
    expect(changes.find((section) => section.text === 'B')?.status).toBe('unchanged')
  })

  test('an insertion does not mark the later sections moved', () => {
    const changes = changesOf(
      doc(heading(1, 'A', 'a1'), heading(1, 'B', 'b1')),
      doc(heading(1, 'New', 'n1'), heading(1, 'A', 'a1'), heading(1, 'B', 'b1'))
    )
    expect(changes.find((section) => section.text === 'New')?.status).toBe('added')
    expect(changes.find((section) => section.text === 'A')?.status).toBe('unchanged')
    expect(changes.find((section) => section.text === 'B')?.status).toBe('unchanged')
  })

  test('caps the excerpt', () => {
    const [section] = changesOf(
      doc(heading(1, 'Title', 't1'), para(text('body'))),
      doc(heading(1, 'Title', 't1'), para(text('body')), para(text('word '.repeat(200))))
    )
    expect(section.excerpt?.length).toBe(EXCERPT_MAX_CHARS)
  })
})
