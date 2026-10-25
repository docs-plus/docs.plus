import { describe, expect, test } from 'bun:test'

import { importMarkdown, parseMarkdown } from '../../domain/markdownImport'

const types = (content: Record<string, unknown>[]) => content.map((node) => node.type)

const firstBlock = (markdown: string) => parseMarkdown(markdown).content[0] as Record<string, any>

const firstText = (markdown: string) => firstBlock(markdown).content[0] as Record<string, any>

// #335: StarterKit's `link` claimed the token while it came first, and the pad
// cannot preview or edit a `link` mark.
describe('parseMarkdown', () => {
  test('puts a Markdown link on the hyperlink mark', () => {
    const text = firstText('[Budget](https://example.test/p?id=a)')

    expect(text.marks).toHaveLength(1)
    expect(text.marks[0].type).toBe('hyperlink')
    expect(text.marks[0].attrs.href).toBe('https://example.test/p?id=a')
  })

  test('keeps bold next to the hyperlink mark', () => {
    const text = firstText('**[bold](https://a.test)**')

    expect(text.marks.map((mark: Record<string, unknown>) => mark.type).sort()).toEqual([
      'bold',
      'hyperlink'
    ])
  })

  test('still turns a bare media URL on its own line into media', () => {
    const paragraph = firstBlock('https://example.test/pic.png')

    expect(paragraph.content[0].type).toBe('image')
    expect(paragraph.content[0].attrs.src).toBe('https://example.test/pic.png')
  })
})

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
