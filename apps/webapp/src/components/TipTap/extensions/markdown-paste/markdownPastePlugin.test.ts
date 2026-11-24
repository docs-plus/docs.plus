import { HyperlinkBase } from '@docs.plus/extension-hyperlink'
import { HyperMultimediaKit } from '@docs.plus/extension-hypermultimedia'
import { Editor } from '@tiptap/core'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { sanitizeJsonContent } from '@utils/sanitizeContent'
import { Marked } from 'marked'

import { LegacyLink } from '../../legacyLink'
import { TitleDocument } from '../title-document'
import { MarkdownPaste } from './index'
import {
  looksLikeMarkdown,
  normalizeForTitleDocument,
  normalizeMarkdownJson
} from './markdownPastePlugin'

jest.mock('marked', () => {
  // Jest's CJS runtime rejects marked@17's ESM entry; load its UMD build instead.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(
    path.join(path.dirname(require.resolve('marked/package.json')), 'lib/marked.umd.js')
  )
})

const createTestEditor = (options?: { content?: string | object; onContentError?: jest.Mock }) => {
  return new Editor({
    enableContentCheck: true,
    onContentError: options?.onContentError,
    content: options?.content ?? '<h1>Title</h1><p>Body</p>',
    extensions: [
      StarterKit.configure({ document: false, link: false }),
      LegacyLink,
      HyperlinkBase.configure({ linkOnPaste: false, autolink: false }),
      HyperMultimediaKit.configure({ Image: { inline: true } }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      TitleDocument,
      Markdown.configure({ marked: new Marked() as never }),
      MarkdownPaste
    ]
  })
}

const dispatchPlainPaste = (editor: Editor, text: string) => {
  const clipboardData = {
    types: ['text/plain'],
    getData: (type: string) => (type === 'text/plain' ? text : '')
  } as unknown as DataTransfer

  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', { value: clipboardData })

  editor.view.someProp('handlePaste', (fn) => fn(editor.view, event, undefined as never))
  return event
}

describe('looksLikeMarkdown', () => {
  it('detects GFM tables including indented, pipe-less outer borders, and CRLF', () => {
    expect(looksLikeMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |').matches).toContain('gfmTable')
    expect(looksLikeMarkdown('  | A | B |\n  | --- | --- |\n  | 1 | 2 |').matches).toContain(
      'gfmTable'
    )
    expect(looksLikeMarkdown('A | B\n--- | ---\n1 | 2').matches).toContain('gfmTable')
    expect(looksLikeMarkdown('  A | B\n  --- | ---\n  1 | 2').matches).toContain('gfmTable')
    expect(looksLikeMarkdown('| A |\n| --- |\n| 1 |').matches).toContain('gfmTable')
    expect(
      looksLikeMarkdown('| A | B |\r\n| :--- | ---: |\r\n| a | b |').score
    ).toBeGreaterThanOrEqual(6)
  })

  it('rejects non-table pipe lines and setext headings', () => {
    expect(looksLikeMarkdown('foo | bar\n   |   ').score).toBeLessThan(6)
    expect(looksLikeMarkdown('A | B\n---').matches).not.toContain('gfmTable')
    expect(looksLikeMarkdown('foo | bar\n=== | ===').matches).not.toContain('gfmTable')
  })

  it('rejects large whitespace, indented pipe-less lines, and unclosed brackets in linear time', () => {
    const samples = [
      ' '.repeat(100_000),
      (' '.repeat(25_000) + 'hello\n').repeat(4),
      'a|\n|---' + ' '.repeat(100_000) + 'x',
      '[a'.repeat(50_000),
      '![a'.repeat(50_000),
      '![a](b'.repeat(83_000),
      '![](b'.repeat(99_000),
      '[a](https://x'.repeat(38_000),
      '[a](https://en.wikipedia.org/wiki/Foo_('.repeat(10_000)
    ]

    for (const sample of samples) {
      const start = performance.now()
      const result = looksLikeMarkdown(sample)
      const elapsedMs = performance.now() - start

      expect(result.score).toBe(0)
      expect(result.matches).toEqual([])
      expect(elapsedMs).toBeLessThan(50)
    }
  })

  it('detects Wikipedia parenthesized URLs and badge-in-link Markdown', () => {
    expect(looksLikeMarkdown('[Foo](https://en.wikipedia.org/wiki/Foo_(bar))').matches).toContain(
      'inlineLink'
    )
    expect(looksLikeMarkdown('[![badge](badge.png)](https://example.com)').matches).toContain(
      'image'
    )
  })

  it('detects task lists and rejects blank task brackets', () => {
    expect(looksLikeMarkdown('- [ ] todo').matches).toContain('taskList')
    expect(looksLikeMarkdown('* [X] done').score).toBeGreaterThanOrEqual(6)
    expect(looksLikeMarkdown('  + [x] nested').matches).toContain('taskList')
    expect(looksLikeMarkdown('- [ ]   \nnext').matches).not.toContain('taskList')
  })

  it('detects multi-heading pastes while keeping lone heading and YAML below threshold', () => {
    const multi = looksLikeMarkdown('# Title\n\n## Section')
    expect(multi.matches).toContain('multiHeading')
    expect(multi.score).toBeGreaterThanOrEqual(6)

    expect(looksLikeMarkdown('## Not enough signal').score).toBeLessThan(6)
    expect(looksLikeMarkdown('#1\n#2').score).toBe(0)
    expect(looksLikeMarkdown('- name: web\n- name: db\n\n---\n\n- name: cache').score).toBeLessThan(
      6
    )
  })
})

describe('normalizeMarkdownJson and normalizeForTitleDocument', () => {
  let editor: Editor

  beforeEach(() => {
    editor = createTestEditor()
  })

  afterEach(() => {
    editor.destroy()
  })

  it('wraps stray inline images into paragraphs so schema check passes', () => {
    const raw = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'Alt' } }
      ]
    }

    const normalized = normalizeMarkdownJson(raw, editor.schema, { fullDoc: true })
    expect(normalized.content?.[1].type).toBe('paragraph')
    expect(() => editor.schema.nodeFromJSON(normalized).check()).not.toThrow()
  })

  it('unwraps block media out of paragraphs and keeps listItem paragraph-first invariant', () => {
    const raw = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } }
          ]
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'youtube',
                      attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    const normalized = normalizeMarkdownJson(raw, editor.schema, { fullDoc: true })
    expect(normalized.content?.[1].type).toBe('youtube')
    const listItem = normalized.content?.[2].content?.[0]
    expect(listItem?.content?.[0].type).toBe('paragraph')
    expect(listItem?.content?.[1].type).toBe('youtube')
    expect(() => editor.schema.nodeFromJSON(normalized).check()).not.toThrow()
  })

  it('normalizes TitleDocument headings, paragraphs, block-first docs, image-only docs, and empty docs', () => {
    const h2First = normalizeForTitleDocument({
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sub' }] }
      ]
    })
    expect(h2First.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } })

    const paraFirst = normalizeForTitleDocument({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] }]
    })
    expect(paraFirst.content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Intro' }]
    })

    const codeFirst = normalizeForTitleDocument({
      type: 'doc',
      content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'const x = 1' }] }]
    })
    expect(codeFirst.content?.[0]).toEqual({ type: 'heading', attrs: { level: 1 } })
    expect(codeFirst.content?.[1].type).toBe('codeBlock')

    const imageOnly = normalizeForTitleDocument({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'image', attrs: { src: 'https://example.com/a.png' } }]
        }
      ]
    })
    expect(imageOnly.content?.[0]).toEqual({ type: 'heading', attrs: { level: 1 } })
    expect(imageOnly.content?.[1].type).toBe('paragraph')

    const empty = normalizeForTitleDocument({ type: 'doc', content: [] })
    expect(empty.content).toEqual([{ type: 'heading', attrs: { level: 1 } }])
  })

  it('strips unsafe hyperlink marks and preserves safe data:image media src', () => {
    const cleaned = sanitizeJsonContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'xss',
              marks: [{ type: 'hyperlink', attrs: { href: 'javascript:alert(1)' } }]
            },
            {
              type: 'image',
              attrs: { src: 'data:image/png;base64,abc123' }
            },
            {
              type: 'image',
              attrs: { src: 'data:image/svg+xml;base64,PHN2Zy8+' }
            }
          ]
        }
      ]
    })
    const paragraphContent = cleaned.content?.[0].content
    expect(paragraphContent?.[0].marks).toBeUndefined()
    expect(paragraphContent?.[1].attrs?.src).toBe('data:image/png;base64,abc123')
    expect(paragraphContent?.[2].attrs?.src).toBeUndefined()
  })
})

describe('MarkdownPaste integration with enableContentCheck and LegacyLink', () => {
  it('parses Markdown links to hyperlink marks and keeps legacy link marks valid without content errors', () => {
    const onContentError = jest.fn()
    const editor = createTestEditor({
      onContentError,
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Stored',
                marks: [{ type: 'link', attrs: { href: 'https://legacy.example.com' } }]
              }
            ]
          }
        ]
      }
    })

    expect(onContentError).not.toHaveBeenCalled()
    expect(editor.getMarkdown()).toContain('[Stored](https://legacy.example.com)')

    editor.commands.selectAll()
    dispatchPlainPaste(
      editor,
      '# New Title\n\nVisit [Example](https://example.com).\n\n![Img](https://example.com/a.png)'
    )

    expect(onContentError).not.toHaveBeenCalled()
    const markNames: string[] = []
    editor.state.doc.descendants((node) => {
      node.marks.forEach((mark) => markNames.push(mark.type.name))
    })
    expect(markNames).toContain('hyperlink')
    expect(markNames).not.toContain('link')
    expect(() => editor.state.doc.check()).not.toThrow()

    editor.commands.selectAll()
    dispatchPlainPaste(editor, '```js\nconst a = 1\n```')
    expect(onContentError).not.toHaveBeenCalled()
    expect(editor.state.doc.firstChild?.type.name).toBe('heading')
    expect(() => editor.state.doc.check()).not.toThrow()

    editor.destroy()
  })
})
