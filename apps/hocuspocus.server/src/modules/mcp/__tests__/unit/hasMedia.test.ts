import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'

import { hasMedia } from '../../domain/redactMedia'

const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {})
})
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const link = (href: string) => [{ type: 'hyperlink', attrs: { href } }]

describe('hasMedia', () => {
  test('finds each kind of media at any depth, and nothing in plain text', () => {
    expect(hasMedia([paragraph(text('plain'), text('site', link('https://a.test')))])).toBe(false)

    expect(hasMedia([paragraph(text('see '), { type: 'image', attrs: { src: 'x.png' } })])).toBe(
      true
    )
    expect(hasMedia([{ type: 'youtube', attrs: { src: 'https://youtu.be/x' } }])).toBe(true)
    expect(hasMedia([{ type: 'mediaUploadPlaceholder' }])).toBe(true)
    expect(
      hasMedia([
        paragraph(text('file.pdf', link('https://api.test/plugins/hypermultimedia/d/f.pdf')))
      ])
    ).toBe(true)

    const nested: JSONContent = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [paragraph({ type: 'image', attrs: { src: 'y.png' } })] }
      ]
    }
    expect(hasMedia([nested, paragraph(text('after'))])).toBe(true)
  })

  test('walks a 5000-level deep tree iteratively without stack overflow', () => {
    let withMedia: JSONContent = paragraph({ type: 'image', attrs: { src: 'deep.png' } })
    let plain: JSONContent = paragraph(text('deep plain'))
    for (let i = 0; i < 5000; i += 1) {
      withMedia = { type: 'blockquote', content: [withMedia] }
      plain = { type: 'blockquote', content: [plain] }
    }

    expect(hasMedia([withMedia])).toBe(true)
    expect(hasMedia([plain])).toBe(false)
  })
})
