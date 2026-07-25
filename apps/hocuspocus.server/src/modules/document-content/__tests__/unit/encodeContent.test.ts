import { describe, expect, test } from 'bun:test'
import { TiptapTransformer } from '@hocuspocus/transformer'

import { encodeContent, TITLE_HEADING_DETAIL } from '../../domain/encodeContent'
import type { TiptapDocJson } from '../../types'
import { MAX_CONTENT_DEPTH, MAX_CONTENT_NODES } from '../../types'

const title = (text = 'Title'): Record<string, unknown> => ({
  type: 'heading',
  attrs: { level: 1 },
  content: [{ type: 'text', text }]
})

const doc = (...content: Record<string, unknown>[]): TiptapDocJson => ({ type: 'doc', content })

const encodeReplace = (payload: TiptapDocJson) =>
  encodeContent(payload, { requireTitleHeading: true })
const encodeAppend = (payload: TiptapDocJson) =>
  encodeContent(payload, { requireTitleHeading: false })

const decode = (scratch: Parameters<typeof TiptapTransformer.fromYdoc>[0]) =>
  TiptapTransformer.fromYdoc(scratch, 'default') as { content: Record<string, any>[] }

describe('encodeContent — schema coverage', () => {
  test('encodes a document exercising the whole server extension set', () => {
    const payload = doc(
      {
        type: 'heading',
        attrs: { level: 1, 'toc-id': 'keepThisId000000' },
        content: [{ type: 'text', text: 'Title' }]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'plain ' },
          { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
          { type: 'text', marks: [{ type: 'highlight', attrs: { color: '#ff0' } }], text: 'lit' },
          {
            type: 'text',
            marks: [{ type: 'hyperlink', attrs: { href: 'https://docs.plus' } }],
            text: 'link'
          },
          { type: 'text', marks: [{ type: 'inlineCode' }], text: 'code' }
        ]
      },
      // Image is inline in the webapp, so a valid payload wraps it in a block.
      { type: 'paragraph', content: [{ type: 'image', attrs: { src: 'https://cdn.test/a.png' } }] },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }]
          }
        ]
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                attrs: { colspan: 1, rowspan: 1 },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }]
              },
              {
                type: 'tableCell',
                attrs: { colspan: 1, rowspan: 1 },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C' }] }]
              }
            ]
          }
        ]
      }
    )

    const result = encodeReplace(payload)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const back = decode(result.scratch)
    expect(back.content.map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'taskList',
      'table'
    ])
    expect(back.content[0].attrs['toc-id']).toBe('keepThisId000000')
    expect(back.content[1].content.map((n: any) => n.text).join('')).toBe('plain boldlitlinkcode')
    expect(back.content[1].content[2].marks[0]).toMatchObject({
      type: 'highlight',
      attrs: { color: '#ff0' }
    })
    expect(back.content[1].content[3].marks[0].attrs.href).toBe('https://docs.plus')
    expect(back.content[1].content[4].marks[0].type).toBe('inlineCode')
    expect(back.content[2].content[0]).toMatchObject({
      type: 'image',
      attrs: { src: 'https://cdn.test/a.png' }
    })
    expect(back.content[3].content[0].attrs.checked).toBe(true)
    expect(back.content[4].content[0].content[1].content[0].content[0].text).toBe('C')
  })

  test('rejects an unknown node type without throwing', () => {
    const result = encodeReplace(doc(title(), { type: 'totallyUnknownNode' }))
    expect(result).toMatchObject({ ok: false, reason: 'invalid-content' })
  })

  test('rejects an unknown mark type without throwing', () => {
    const result = encodeReplace(
      doc({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'T', marks: [{ type: 'nopeMark' }] }]
      })
    )
    expect(result).toMatchObject({ ok: false, reason: 'invalid-content' })
  })
})

describe('encodeContent — structural validation', () => {
  // Node.fromJSON never checks content expressions, so each of these encodes and
  // round-trips cleanly; the first browser to open the doc would delete the
  // subtree (y-tiptap) or hard-freeze on enableContentCheck.
  test('rejects a heading nested inside a paragraph', () => {
    const result = encodeReplace(
      doc(title(), {
        type: 'paragraph',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'bad' }] }
        ]
      })
    )
    expect(result.ok).toBe(false)
  })

  test('rejects a taskItem at document root', () => {
    const result = encodeReplace(
      doc(title(), {
        type: 'taskItem',
        attrs: { checked: false },
        content: [{ type: 'paragraph' }]
      })
    )
    expect(result.ok).toBe(false)
  })

  test('rejects a top-level image', () => {
    const result = encodeReplace(
      doc(title(), { type: 'image', attrs: { src: 'https://cdn.test/a.png' } })
    )
    expect(result.ok).toBe(false)
  })
})

describe('encodeContent — title-first contract', () => {
  test('rejects a paragraphs-only replace payload', () => {
    const result = encodeReplace(
      doc({ type: 'paragraph', content: [{ type: 'text', text: 'body' }] })
    )
    expect(result).toMatchObject({ ok: false, detail: TITLE_HEADING_DETAIL })
  })

  test('rejects a level-2 first heading on replace', () => {
    const result = encodeReplace(
      doc({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'sub' }] })
    )
    expect(result).toMatchObject({ ok: false, detail: TITLE_HEADING_DETAIL })
  })

  test('accepts a heading-first payload', () => {
    expect(encodeReplace(doc(title())).ok).toBe(true)
  })

  test('accepts a heading-less payload when the title rule is off (append)', () => {
    expect(
      encodeAppend(doc({ type: 'paragraph', content: [{ type: 'text', text: 'more' }] })).ok
    ).toBe(true)
  })
})

describe('encodeContent — toc-id identity stamping', () => {
  test('stamps a 16-char id on headings and tables that carry none', () => {
    const payload = doc(title(), {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1 },
              content: [{ type: 'paragraph' }]
            }
          ]
        }
      ]
    })
    const result = encodeReplace(payload)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Read the ids back off the encoded document, not the mutated payload: an
    // extension set that stopped registering `toc-id` on table would drop the
    // stamp at encode and a payload-side assertion would never notice.
    const encoded = decode(result.scratch)
    const headingId = encoded.content[0].attrs['toc-id']
    const tableId = encoded.content[1].attrs['toc-id']
    expect(headingId).toMatch(/^[0-9A-Za-z]{16}$/)
    expect(tableId).toMatch(/^[0-9A-Za-z]{16}$/)
    expect(headingId).not.toBe(tableId)
  })

  test('preserves a caller-supplied toc-id verbatim', () => {
    const payload = doc({
      type: 'heading',
      attrs: { level: 1, 'toc-id': 'callerSuppliedId' },
      content: [{ type: 'text', text: 'T' }]
    })
    const result = encodeReplace(payload)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(decode(result.scratch).content[0].attrs['toc-id']).toBe('callerSuppliedId')
  })

  test('restamps the second occurrence of a duplicated toc-id', () => {
    const payload = doc(
      {
        type: 'heading',
        attrs: { level: 1, 'toc-id': 'sharedIdXXXXXXXX' },
        content: [{ type: 'text', text: 'A' }]
      },
      {
        type: 'heading',
        attrs: { level: 2, 'toc-id': 'sharedIdXXXXXXXX' },
        content: [{ type: 'text', text: 'B' }]
      }
    )
    const result = encodeReplace(payload)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const encoded = decode(result.scratch)
    const first = encoded.content[0].attrs['toc-id']
    const second = encoded.content[1].attrs['toc-id']
    expect(first).toBe('sharedIdXXXXXXXX')
    expect(second).not.toBe(first)
    expect(second).toMatch(/^[0-9A-Za-z]{16}$/)
  })
})

describe('encodeContent — availability caps', () => {
  // Both payloads carry node types the transformer would throw on, so the cap
  // message in `detail` is proof the pre-walk short-circuited before toYdoc.
  test('rejects a payload over MAX_CONTENT_NODES before the transformer runs', () => {
    const overflow = Array.from({ length: MAX_CONTENT_NODES + 1 }, () => ({
      type: 'totallyUnknownNode'
    }))
    const result = encodeReplace(doc(title(), ...overflow))
    expect(result).toMatchObject({
      ok: false,
      detail: `content exceeds MAX_CONTENT_NODES (${MAX_CONTENT_NODES})`
    })
  })

  test('rejects a payload over MAX_CONTENT_DEPTH before the transformer runs', () => {
    let deep: Record<string, unknown> = { type: 'totallyUnknownNode' }
    for (let i = 0; i < MAX_CONTENT_DEPTH + 50; i += 1) {
      deep = { type: 'totallyUnknownNode', content: [deep] }
    }
    const result = encodeReplace(doc(title(), deep))
    expect(result).toMatchObject({
      ok: false,
      detail: `content exceeds MAX_CONTENT_DEPTH (${MAX_CONTENT_DEPTH})`
    })
  })
})
