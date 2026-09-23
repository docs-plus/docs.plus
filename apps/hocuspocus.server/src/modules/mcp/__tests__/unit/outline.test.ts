import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'

import { REV_PATTERN } from '../../../document-content/domain/sections'
import { buildOutline } from '../../domain/outline'
import type { OutlineNode } from '../../types'

const heading = (id: string, level: number, text: string): JSONContent => ({
  type: 'heading',
  attrs: { level, 'toc-id': id },
  content: [{ type: 'text', text }]
})
const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }]
})

const ids = (nodes: OutlineNode[]): string[] => nodes.map((node) => node.id ?? '')

describe('buildOutline', () => {
  test('a document with no headings has an empty outline', () => {
    expect(buildOutline({ type: 'doc', content: [paragraph('a'), paragraph('b')] })).toEqual([])
  })

  test('every parent holds each later heading until one of the same or a smaller level', () => {
    const outline = buildOutline({
      type: 'doc',
      content: [
        heading('t', 1, 'Title'),
        heading('a', 2, 'A'),
        heading('a1', 3, 'A1'),
        paragraph('body'),
        heading('a2', 3, 'A2'),
        heading('b', 2, 'B'),
        heading('b1', 4, 'B1')
      ]
    })

    const [title] = outline
    expect(ids(outline)).toEqual(['t'])
    expect(ids(title?.children ?? [])).toEqual(['a', 'b'])
    expect(ids(title?.children[0]?.children ?? [])).toEqual(['a1', 'a2'])
    expect(ids(title?.children[1]?.children ?? [])).toEqual(['b1'])

    const walk = (nodes: OutlineNode[]): void => {
      for (const node of nodes) {
        expect(node.rev).toMatch(REV_PATTERN)
        walk(node.children)
      }
    }
    walk(outline)
  })

  // A write resolves a repeated id to its first heading, so the second must not offer it.
  test('a repeated toc-id is offered once, on its first heading', () => {
    const outline = buildOutline({
      type: 'doc',
      content: [heading('t', 1, 'Title'), heading('a', 2, 'First'), heading('a', 2, 'Second')]
    })

    expect(outline[0]?.children).toMatchObject([
      { id: 'a', title: 'First' },
      { id: null, title: 'Second', rev: null }
    ])
  })
})
