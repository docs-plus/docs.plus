import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'

import { parseMarkdown } from '../../../document-conversion/domain/markdownImport'
import { checkFragment } from '../../domain/checkFragment'

describe('checkFragment', () => {
  test('rejects nested H1 headings in blockquotes, lists, tasks, and tables when intoEmpty is false', () => {
    const markdownCases = [
      '> # Secret H1',
      '- item\n\n  # Secret H1',
      '- [ ] item\n\n  # Secret H1'
    ]
    for (const markdown of markdownCases) {
      const parsed = parseMarkdown(markdown)
      expect(checkFragment(parsed.content as JSONContent[], false)).toBe('title-not-allowed')
    }

    const tableWithH1: JSONContent[] = [
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'H1' }] }
                ]
              }
            ]
          }
        ]
      }
    ]
    expect(checkFragment(tableWithH1, false)).toBe('title-not-allowed')

    let deepQuote: JSONContent = {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Deep H1' }]
    }
    for (let i = 0; i < 5000; i += 1) {
      deepQuote = { type: 'blockquote', content: [deepQuote] }
    }
    expect(checkFragment([deepQuote], false)).toBe('title-not-allowed')
  })

  test('allows nested H2 headings when intoEmpty is false', () => {
    const parsed = parseMarkdown('> ## Subheading\n\n- item\n\n  ## Nested H2')
    expect(checkFragment(parsed.content as JSONContent[], false)).toBeNull()
  })

  test('enforces top-level title first and rejects nested extra H1s when intoEmpty is true', () => {
    const nestedOnly = parseMarkdown('> # Secret H1')
    expect(checkFragment(nestedOnly.content as JSONContent[], true)).toBe('missing-title')

    const titlePlusNested = parseMarkdown('# Title\n\n> # Secret H1')
    expect(checkFragment(titlePlusNested.content as JSONContent[], true)).toBe('extra-title')

    const valid = parseMarkdown('# Title\n\n> ## Sub')
    expect(checkFragment(valid.content as JSONContent[], true)).toBeNull()
  })
})
