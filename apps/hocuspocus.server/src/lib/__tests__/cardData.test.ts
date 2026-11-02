import { describe, expect, test } from 'bun:test'

import {
  OUTLINE_MAX_ITEMS,
  parseCardData,
  STORED_LINE_MAX
} from '../../modules/social-card/domain/storedData'
import { cardDataFromPmJson, storedLine } from '../cardData'

const text = (value: string) => ({ type: 'text', text: value })
const heading = (value: string, level: number, id?: string) => ({
  type: 'heading',
  attrs: { level, ...(id ? { 'toc-id': id } : {}) },
  content: [text(value)]
})
const paragraph = (value: string) => ({ type: 'paragraph', content: value ? [text(value)] : [] })
const list = (type: string, items: string[], checked: boolean[] = []) => ({
  type,
  content: items.map((value, i) => ({
    type: type === 'taskList' ? 'taskItem' : 'listItem',
    attrs: { checked: checked[i] ?? false },
    content: [paragraph(value)]
  }))
})
const doc = (...content: unknown[]) => ({ type: 'doc', content })

describe('cardDataFromPmJson', () => {
  test('first blocks skip the Title, headings, code and empty lines, and stop at four lines', () => {
    const { blocks } = cardDataFromPmJson(
      doc(
        heading('Plan', 1, 'title'),
        paragraph(''),
        { type: 'codeBlock', content: [text('const x = 1')] },
        paragraph('First line'),
        heading('Later', 2, 'h1'),
        { type: 'blockquote', content: [paragraph('Quoted'), paragraph('twice')] },
        list('taskList', ['Done', 'Open', 'Never drawn'], [true]),
        paragraph('Past the budget')
      )
    )
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'First line' },
      { kind: 'paragraph', text: 'Quoted twice' },
      { kind: 'list', list: 'task', items: [{ text: 'Done', checked: true }, { text: 'Open' }] }
    ])
  })

  test('a pad with no Title heading starts at the first block', () => {
    const { blocks, outline } = cardDataFromPmJson(doc(paragraph('Lead'), heading('A', 1, 'a')))
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'Lead' }])
    expect(outline).toMatchObject({ title: null, titleId: null, items: [{ id: 'a', parent: -1 }] })
  })

  test('outline items nest by containment, keep their own blocks, and drop repeats', () => {
    const { outline } = cardDataFromPmJson(
      doc(
        heading('Plan', 1, 'title'),
        heading('Goals', 1, 'g'),
        paragraph('Why we start'),
        heading('Q1', 3, 'q1'),
        list('orderedList', ['Ship', 'Measure']),
        heading('No id', 2),
        heading('Copy of Goals', 2, 'g'),
        heading('Copy of Title', 2, 'title'),
        heading('Risks', 2, 'r'),
        heading('Budget', 1, 'b')
      )
    )
    expect(outline).toEqual({
      title: 'Plan',
      titleId: 'title',
      items: [
        {
          id: 'g',
          level: 1,
          text: 'Goals',
          parent: -1,
          blocks: [{ kind: 'paragraph', text: 'Why we start' }]
        },
        {
          id: 'q1',
          level: 3,
          text: 'Q1',
          parent: 0,
          blocks: [
            { kind: 'list', list: 'ordered', items: [{ text: 'Ship' }, { text: 'Measure' }] }
          ]
        },
        { id: 'r', level: 2, text: 'Risks', parent: 0, blocks: [] },
        { id: 'b', level: 1, text: 'Budget', parent: -1, blocks: [] }
      ]
    })
    // The card reads it back through its own parser, so the shapes must agree.
    const stored = cardDataFromPmJson(doc(heading('T', 1, 't'), heading('Plan', 1, 'p')))
    expect(parseCardData(JSON.parse(JSON.stringify(stored)))).toEqual({
      blocks: stored.blocks,
      outline: stored.outline
    })
  })

  test('the outline stops at the item cap; too big, it drops section blocks, then itself', () => {
    const many = Array.from({ length: OUTLINE_MAX_ITEMS + 5 }, (_, i) =>
      heading(`H${i}`, 2, `id${i}`)
    )
    const capped = cardDataFromPmJson(doc(heading('T', 1, 't'), ...many)).outline
    expect(capped?.items).toHaveLength(OUTLINE_MAX_ITEMS)
    expect(capped?.truncated).toBe(true)

    const long = 'word '.repeat(40)
    const withBlocks = Array.from({ length: 100 }, (_, i) => [
      heading(`H${i}`, 2, `id${i}`),
      paragraph(long),
      paragraph(long),
      paragraph(long)
    ]).flat()
    const bare = cardDataFromPmJson(doc(heading('T', 1, 't'), ...withBlocks)).outline
    expect(bare?.items).toHaveLength(100)
    expect(bare?.items.every((item) => item.blocks.length === 0)).toBe(true)

    // 80 four-byte graphemes per heading: too big even with no blocks.
    const heavy = Array.from({ length: OUTLINE_MAX_ITEMS }, (_, i) =>
      heading(`${'😀'.repeat(90)}${i}`, 2, `id${i}`)
    )
    expect(cardDataFromPmJson(doc(heading('T', 1, 't'), ...heavy)).outline).toBeNull()
  })
})

describe('storedLine', () => {
  test('cuts by grapheme, never inside an emoji, and marks the cut', () => {
    const family = '👨‍👩‍👧'
    const cut = storedLine(family.repeat(STORED_LINE_MAX + 5))
    expect(cut.endsWith('…')).toBe(true)
    expect(cut).toBe(`${family.repeat(STORED_LINE_MAX - 1)}…`)
    expect(storedLine(` a\n\tb ${'x'.repeat(10)} `)).toBe(`a b ${'x'.repeat(10)}`)
  })
})
