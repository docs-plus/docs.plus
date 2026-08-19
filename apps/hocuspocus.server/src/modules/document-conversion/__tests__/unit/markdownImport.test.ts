import { describe, expect, test } from 'bun:test'

import { importMarkdown } from '../../domain/markdownImport'

const types = (content: Record<string, unknown>[]) => content.map((node) => node.type)

describe('importMarkdown', () => {
  // `marked` emits a lone image as a root node. `image` is inline, so the result
  // used to fail `PATCH /content` with "Invalid content for node doc", and the
  // two documented routes did not compose.
  test('wraps a root-level image so the content PATCH accepts the result', () => {
    const { content } = importMarkdown(
      '# Probe\n\nA paragraph.\n\n![alt text](https://example.test/pic.png)\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'paragraph', 'paragraph'])

    const wrapper = content.content[2] as Record<string, any>
    expect(wrapper.content[0].type).toBe('image')
    expect(wrapper.content[0].attrs.src).toBe('https://example.test/pic.png')
  })

  test('leaves block nodes at the root untouched', () => {
    const { content } = importMarkdown('# Probe\n\nOne.\n\n> Quoted.\n\n- item\n', 'Fallback')

    expect(types(content.content)).toEqual(['heading', 'paragraph', 'blockquote', 'bulletList'])
  })

  // `blockquote` takes blocks, so a quoted lone image hit the same 422 one level
  // down: "Invalid content for node blockquote: <image>".
  test('wraps an inline node inside a block container, not only at the root', () => {
    const { content } = importMarkdown(
      '# Probe\n\n> ![alt text](https://example.test/pic.png)\n',
      'Fallback'
    )

    const quote = content.content[1] as Record<string, any>
    expect(quote.type).toBe('blockquote')
    expect(types(quote.content)).toEqual(['paragraph'])
    expect(quote.content[0].content[0].type).toBe('image')
  })

  test('leaves a paragraph’s own inline children alone', () => {
    const { content } = importMarkdown(
      '# Probe\n\nText ![alt](https://example.test/p.png) more\n',
      'Fallback'
    )

    const para = content.content[1] as Record<string, any>
    expect(para.type).toBe('paragraph')
    expect(types(para.content)).toEqual(['text', 'image', 'text'])
  })
})
