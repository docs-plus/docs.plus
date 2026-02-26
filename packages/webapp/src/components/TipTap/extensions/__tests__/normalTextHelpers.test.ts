/**
 * Unit tests for normalizeHeading and partitionContentBlocks
 * from normalText/onHeading.ts
 *
 * These are pure data transforms — ideal for unit testing.
 * The full onHeading flow is tested via E2E (heading-2-normal-text specs).
 */

import { TIPTAP_NODES } from '@types'

import { normalizeHeading, partitionContentBlocks } from '../normalText/onHeading'

// ---------------------------------------------------------------------------
// normalizeHeading
// ---------------------------------------------------------------------------

describe('normalizeHeading', () => {
  it('uses `le` field when present', () => {
    const result = normalizeHeading({ type: 'heading', le: 3, startBlockPos: 100 } as any)
    expect(result.le).toBe(3)
    expect(result.startBlockPos).toBe(100)
  })

  it('falls back to `level` field when `le` is absent', () => {
    const result = normalizeHeading({ type: 'heading', level: 5, startBlockPos: 0 } as any)
    expect(result.le).toBe(5)
  })

  it('falls back to content[0].attrs.level when both le and level are absent', () => {
    const result = normalizeHeading({
      type: 'heading',
      content: [{ type: 'contentHeading', attrs: { level: 7 } }]
    } as any)
    expect(result.le).toBe(7)
  })

  it('defaults to level 1 when no level source is available', () => {
    const result = normalizeHeading({ type: 'heading' } as any)
    expect(result.le).toBe(1)
    expect(result.startBlockPos).toBe(0)
  })

  it('preserves all original fields', () => {
    const result = normalizeHeading({
      type: 'heading',
      le: 4,
      startBlockPos: 50,
      custom: 'data'
    } as any)
    expect((result as any).custom).toBe('data')
    expect(result.type).toBe('heading')
  })

  it('prefers `le` over `level` when both are present', () => {
    const result = normalizeHeading({ type: 'heading', le: 2, level: 8, startBlockPos: 0 } as any)
    expect(result.le).toBe(2)
  })

  it('prefers le/level over content attrs level', () => {
    const result = normalizeHeading({
      type: 'heading',
      level: 4,
      content: [{ type: 'contentHeading', attrs: { level: 9 } }],
      startBlockPos: 0
    } as any)
    expect(result.le).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// partitionContentBlocks
// ---------------------------------------------------------------------------

describe('partitionContentBlocks', () => {
  it('separates paragraphs from headings', () => {
    const blocks = [
      { type: 'paragraph', content: 'text1' },
      { type: TIPTAP_NODES.HEADING_TYPE, le: 2 },
      { type: 'paragraph', content: 'text2' },
      { type: TIPTAP_NODES.HEADING_TYPE, le: 3 }
    ]

    const { paragraphs, headings } = partitionContentBlocks(blocks as any)
    expect(paragraphs).toHaveLength(2)
    expect(headings).toHaveLength(2)
  })

  it('returns empty arrays for empty input', () => {
    const { paragraphs, headings } = partitionContentBlocks([])
    expect(paragraphs).toHaveLength(0)
    expect(headings).toHaveLength(0)
  })

  it('handles all paragraphs (no headings)', () => {
    const blocks = [{ type: 'paragraph' }, { type: 'paragraph' }]
    const { paragraphs, headings } = partitionContentBlocks(blocks as any)
    expect(paragraphs).toHaveLength(2)
    expect(headings).toHaveLength(0)
  })

  it('handles all headings (no paragraphs)', () => {
    const blocks = [{ type: TIPTAP_NODES.HEADING_TYPE }, { type: TIPTAP_NODES.HEADING_TYPE }]
    const { paragraphs, headings } = partitionContentBlocks(blocks as any)
    expect(paragraphs).toHaveLength(0)
    expect(headings).toHaveLength(2)
  })

  it('treats non-heading block types as paragraphs', () => {
    const blocks = [
      { type: 'bulletList' },
      { type: 'orderedList' },
      { type: TIPTAP_NODES.HEADING_TYPE },
      { type: 'codeBlock' }
    ]
    const { paragraphs, headings } = partitionContentBlocks(blocks as any)
    expect(paragraphs).toHaveLength(3)
    expect(headings).toHaveLength(1)
  })
})
