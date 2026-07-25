import { describe, expect, test } from 'bun:test'

import { ensureTitleHeading } from '../../domain/ensureTitleHeading'
import type { TiptapDocJson } from '../../types'

const doc = (...content: Record<string, unknown>[]): TiptapDocJson => ({ type: 'doc', content })

const paragraph = (text: string, marks?: Record<string, unknown>[]) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, ...(marks ? { marks } : {}) }]
})

const firstNode = (result: TiptapDocJson) => result.content[0] as Record<string, any>

describe('ensureTitleHeading', () => {
  test('forces an opening heading to level 1', () => {
    const { doc: out, branch } = ensureTitleHeading(
      doc({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Deep' }] }),
      'Fallback'
    )

    expect(branch).toBe('already-heading')
    expect(firstNode(out).attrs.level).toBe(1)
    expect(firstNode(out).content[0].text).toBe('Deep')
  })

  test('promotes a first paragraph, dropping its marks and paragraph-only attrs', () => {
    const first = {
      ...paragraph('Quarterly Report', [{ type: 'bold' }]),
      attrs: { paragraphStyle: 'lead' }
    }
    const { doc: out, branch } = ensureTitleHeading(doc(first, paragraph('Body')), 'Fallback')

    expect(branch).toBe('promoted-paragraph')
    expect(firstNode(out).type).toBe('heading')
    expect(firstNode(out).attrs).toEqual({ level: 1 })
    expect(firstNode(out).content).toEqual([{ type: 'text', text: 'Quarterly Report' }])
    expect(out.content[1]).toEqual(paragraph('Body'))
  })

  test('synthesizes a heading when the first paragraph carries no text', () => {
    const { doc: out, branch } = ensureTitleHeading(
      doc({ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'a.png' } }] }),
      'Fallback'
    )

    expect(branch).toBe('synthesized')
    expect(firstNode(out)).toEqual({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Fallback' }]
    })
    expect(out.content).toHaveLength(2)
  })

  test('synthesizes a bare heading for an empty document and a blank title', () => {
    expect(ensureTitleHeading(doc(), '   ')).toEqual({
      doc: doc({ type: 'heading', attrs: { level: 1 } }),
      branch: 'synthesized'
    })
  })

  test('leaves the caller document untouched', () => {
    const input = doc(paragraph('Title', [{ type: 'bold' }]))
    const snapshot = structuredClone(input)

    ensureTitleHeading(input, 'Fallback')

    expect(input).toEqual(snapshot)
  })
})
