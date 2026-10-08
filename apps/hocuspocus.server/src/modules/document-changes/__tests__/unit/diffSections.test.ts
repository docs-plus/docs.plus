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

  // The live digest painted two edits an image apart as one green sentence.
  test('marks the gap between two edits that an image separates', () => {
    const image = {
      type: 'paragraph',
      content: [{ type: 'image', attrs: { src: 'https://x.test/1.png' } }]
    }
    const [section] = changesOf(
      doc(
        heading(1, 'Title', 't1'),
        para(text('Kept intro.')),
        para(text('Kept middle.')),
        image,
        para(text('Tail kept.'))
      ),
      doc(
        heading(1, 'Title', 't1'),
        para(text('Kept intro.')),
        para(text('First new line')),
        para(text('Kept middle.')),
        image,
        para(text('Second new line')),
        para(text('Tail kept.'))
      )
    ).filter((row) => row.status === 'modified')
    expect(section.runs?.map((run) => run.kind)).toEqual(['added', 'gap', 'added'])
  })

  test('a long early edit does not hide a later edit', () => {
    const [section] = changesOf(
      doc(heading(1, 'Title', 't1'), para(text('word '.repeat(300))), para(text('Keep A'))),
      doc(heading(1, 'Title', 't1'), para(text('Keep A')), para(text('Added at end')))
    ).filter((row) => row.status === 'modified')
    expect(
      section.runs?.some((run) => run.kind === 'added' && run.text.includes('Added at end'))
    ).toBe(true)
  })
})

const IMAGE = { type: 'image', attrs: { src: 'https://x.test/1.png' } }
const isChange = (run: { kind: string }) => run.kind === 'added' || run.kind === 'removed'
const modifiedOf = (before: TiptapDocJson, after: TiptapDocJson) =>
  changesOf(before, after).filter((row) => row.status === 'modified')

// The live digest painted grey text with no green or red under these headings.
describe('diffSections — an edit with no visible text paints no passage', () => {
  test('a space swapped for U+00A0 after an emoji', () => {
    const [section] = modifiedOf(
      doc(heading(1, '🧰 Tools', 't1'), para(text('body'))),
      doc(heading(1, '🧰\u00a0Tools', 't1'), para(text('body')))
    )
    expect(section.status).toBe('modified')
    expect(section.runs).toBeUndefined()
    expect(section.excerpt).toBeUndefined()
    expect(section.removedExcerpt).toBeUndefined()
  })

  test('a trailing space trimmed from a heading does not echo the heading', () => {
    const [section] = modifiedOf(
      doc(heading(1, 'Intro ', 't1'), para(text('body'))),
      doc(heading(1, 'Intro', 't1'), para(text('body')))
    )
    expect(section.runs).toBeUndefined()
  })

  test('an empty paragraph, or Enter after a paragraph, leaves no grey-only passage', () => {
    const cases: [TiptapDocJson, TiptapDocJson][] = [
      [doc(heading(1, 'Title', 't1')), doc(heading(1, 'Title', 't1'), { type: 'paragraph' })],
      [
        doc(heading(1, 'Title', 't1'), para(text('Hello world'))),
        doc(heading(1, 'Title', 't1'), para(text('Hello world')), { type: 'paragraph' })
      ]
    ]
    for (const [before, after] of cases) {
      const [section] = modifiedOf(before, after)
      const runs = section.runs ?? []
      expect(runs.length === 0 || runs.some(isChange)).toBe(true)
    }
  })

  test('a removed U+FE0F, ZWJ, ZWNJ, word joiner or bidi mark alone paints nothing', () => {
    for (const mark of ['\ufe0f', '\u200d', '\u200c', '\u2060', '\u200e', '\u200f', '\u061c']) {
      const [section] = modifiedOf(
        doc(heading(1, 'Title', 't1'), para(text(`🧰${mark} tools`))),
        doc(heading(1, 'Title', 't1'), para(text('🧰 tools')))
      )
      expect(section.runs).toBeUndefined()
    }
  })

  test('an emoji-only context around a real word change stays', () => {
    const [section] = modifiedOf(
      doc(heading(1, 'Title', 't1'), para(text('🧰 alpha'))),
      doc(heading(1, 'Title', 't1'), para(text('🧰 beta')))
    )
    expect(section.runs).toEqual([
      { kind: 'same', text: '🧰 ' },
      { kind: 'removed', text: 'alpha' },
      { kind: 'added', text: 'beta' }
    ])
  })

  test('no passage ends in a gap after an invisible change', () => {
    const [section] = modifiedOf(
      doc(
        heading(1, 'Title', 't1'),
        para(text('Alpha beta')),
        para(text('Middle words here')),
        para(text(' Gamma'))
      ),
      doc(
        heading(1, 'Title', 't1'),
        para(text('Alpha zeta')),
        para(text('Middle words here')),
        para(text('Gamma'))
      )
    )
    expect(section.runs?.some(isChange)).toBe(true)
    expect(section.runs?.at(-1)?.kind).not.toBe('gap')
  })

  test('an invisible edit between two real edits keeps the gap and the sentence start', () => {
    const filler = 'Some filler words sit here. '.repeat(10)
    const tail = 'the quick brown fox jumps over the lazy dog beta'
    const [section] = modifiedOf(
      doc(heading(1, 'Title', 't1'), para(text(`Alpha one. ${filler}Then x y ${tail} two.`))),
      doc(heading(1, 'Title', 't1'), para(text(`Alpha ONE. ${filler}Then x\u00a0y ${tail} TWO.`)))
    )
    const runs = section.runs ?? []
    const second = runs.findIndex((run) => run.kind === 'same' && run.text.startsWith('Then x'))
    expect(second).toBeGreaterThan(0)
    expect(runs[second - 1]).toEqual({ kind: 'gap', text: '' })
  })
})

describe('diffSections — media reads as a word', () => {
  test('an image added inside a paragraph reads "image"; a hard break alone paints nothing', () => {
    const [withImage] = modifiedOf(
      doc(heading(1, 'Title', 't1'), para(text('See here'))),
      doc(heading(1, 'Title', 't1'), para(text('See '), IMAGE, text('here')))
    )
    expect(withImage.runs?.filter(isChange).map((run) => run.text.trim())).toEqual(['image'])

    const [withBreak] = modifiedOf(
      doc(heading(1, 'Title', 't1'), para(text('See here'))),
      doc(heading(1, 'Title', 't1'), para(text('See here'), { type: 'hardBreak' }))
    )
    expect(withBreak.runs).toBeUndefined()
  })

  test('an added section that holds only an image reads "image" and keeps its count', () => {
    const added = changesOf(
      doc(heading(1, 'Title', 't1')),
      doc(heading(1, 'Title', 't1'), heading(2, 'Pic', 'p1'), para(IMAGE))
    ).find((s) => s.status === 'added')
    expect(added?.runs).toEqual([{ kind: 'added', text: 'image' }])
    expect(added?.excerpt).toBe('image')
    expect(added?.magnitude).toEqual({
      wordsAdded: 1,
      wordsRemoved: 0,
      blocksBefore: 0,
      blocksAfter: 2
    })
  })

  // The summary word counts read this magnitude, so a schema throw must not null it.
  test('a body node the schema rejects keeps the magnitude and falls back to plain text', () => {
    const added = changesOf(
      doc(heading(1, 'Title', 't1')),
      doc(heading(1, 'Title', 't1'), heading(2, 'New', 'n1'), {
        type: 'notInTheSchema',
        content: [text('x y')]
      })
    ).find((s) => s.status === 'added')
    expect(added?.magnitude?.wordsAdded).toBe(3)
    expect(added?.runs).toEqual([{ kind: 'added', text: 'x y' }])
  })
})

describe('diffSections — previousLevel', () => {
  test('a level change carries the baseline level; an unchanged level carries none', () => {
    const [leveled] = modifiedOf(
      doc(heading(1, 'Title', 't1'), heading(2, 'Section', 's1'), para(text('body'))),
      doc(heading(1, 'Title', 't1'), heading(3, 'Section', 's1'), para(text('body')))
    )
    expect(leveled.previousLevel).toBe(2)

    const [edited] = modifiedOf(
      doc(heading(1, 'Title', 't1'), para(text('Hello alpha'))),
      doc(heading(1, 'Title', 't1'), para(text('Hello beta')))
    )
    expect(edited.previousLevel).toBeUndefined()
  })
})
