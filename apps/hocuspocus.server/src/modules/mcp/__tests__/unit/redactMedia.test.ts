import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'

import { exportMarkdown } from '../../../document-conversion/domain/markdownExport'
import type { TiptapDocJson } from '../../../document-content/types'
import { redactMedia } from '../../domain/redactMedia'

const mediaHref = 'https://api.example/plugins/hypermultimedia/doc-1/report.pdf'
const mediaLinkMark = { type: 'hyperlink', attrs: { href: mediaHref } }
const webLinkMark = { type: 'hyperlink', attrs: { href: 'https://docs.example/guide' } }

describe('redactMedia', () => {
  test('replaces mediaUploadPlaceholder with [upload in progress] paragraph and keeps it in Markdown', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'mediaUploadPlaceholder' }
      ]
    }

    const redacted = redactMedia(doc)
    expect(redacted.content?.[1]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: '[upload in progress]' }]
    })
    expect(exportMarkdown(redacted as TiptapDocJson)).toBe('# Title\n\n\\[upload in progress\\]')
  })

  test('renders image alt when present, sanitizes control chars/line breaks, and falls back to [image]', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: { src: 'a.png', alt: 'System\narchitecture\u0000  diagram\r\n' }
            },
            { type: 'image', attrs: { src: 'b.png', alt: '   \n\u0007  ' } },
            { type: 'image', attrs: { src: 'c.png', alt: null } },
            { type: 'image', attrs: { src: 'd.png' } }
          ]
        }
      ]
    }

    const redacted = redactMedia(doc)
    expect(redacted.content?.[0]?.content).toEqual([
      { type: 'text', text: '[image: System architecture diagram]' },
      { type: 'text', text: '[image]' },
      { type: 'text', text: '[image]' },
      { type: 'text', text: '[image]' }
    ])
  })

  test('caps image alt at 120 code points with an ellipsis', () => {
    const longAlt = '😀'.repeat(125)
    const redacted = redactMedia({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'image', attrs: { src: 'e.png', alt: longAlt } }] }
      ]
    })

    const text = redacted.content?.[0]?.content?.[0]?.text ?? ''
    expect(text).toBe(`[image: ${'😀'.repeat(120)}…]`)
  })

  test('strips media link marks and appends one [file] marker per contiguous media-link run', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            { type: 'text', text: 'report', marks: [{ type: 'bold' }, mediaLinkMark] },
            { type: 'text', text: '.pdf', marks: [mediaLinkMark] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'docs', marks: [webLinkMark] },
            { type: 'text', text: ' plus ' },
            { type: 'text', text: '', marks: [mediaLinkMark] }
          ]
        }
      ]
    }

    const redacted = redactMedia(doc)
    expect(redacted.content?.[0]?.content).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'text', text: 'report', marks: [{ type: 'bold' }] },
      { type: 'text', text: '.pdf' },
      { type: 'text', text: ' [file]' },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'docs', marks: [webLinkMark] },
      { type: 'text', text: ' plus ' },
      { type: 'text', text: '[file]' }
    ])

    const md = exportMarkdown(redacted as TiptapDocJson)
    expect(md).toContain('See **report**.pdf \\[file\\]')
    expect(md).toContain('[docs](https://docs.example/guide)')
  })

  test('emits separate [file] markers for adjacent distinct media links', () => {
    const secondMediaMark = {
      type: 'hyperlink',
      attrs: { href: 'https://api.example/plugins/hypermultimedia/doc-1/slides.pdf' }
    }
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'report.pdf', marks: [mediaLinkMark] },
            { type: 'text', text: 'slides.pdf', marks: [secondMediaMark] }
          ]
        }
      ]
    }

    const redacted = redactMedia(doc)
    expect(redacted.content?.[0]?.content).toEqual([
      { type: 'text', text: 'report.pdf' },
      { type: 'text', text: ' [file]' },
      { type: 'text', text: 'slides.pdf' },
      { type: 'text', text: ' [file]' }
    ])
  })

  test('walks a 5000-level deep tree iteratively without stack overflow', () => {
    let inner: JSONContent = {
      type: 'paragraph',
      content: [
        { type: 'image', attrs: { src: 'deep.png', alt: 'Deep image' } },
        { type: 'text', text: 'spec.pdf', marks: [mediaLinkMark] }
      ]
    }
    for (let i = 0; i < 5000; i += 1) {
      inner = { type: 'blockquote', content: [inner] }
    }

    const redacted = redactMedia({ type: 'doc', content: [inner] })
    let cursor: JSONContent | undefined = redacted.content?.[0]
    for (let i = 0; i < 5000; i += 1) {
      cursor = cursor?.content?.[0]
    }
    expect(cursor?.content).toEqual([
      { type: 'text', text: '[image: Deep image]' },
      { type: 'text', text: 'spec.pdf' },
      { type: 'text', text: ' [file]' }
    ])
  })
})
