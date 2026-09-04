import { describe, expect, test } from 'bun:test'
import * as Y from 'yjs'

import {
  EMPTY_DOCUMENT_GRID_PREVIEW,
  extractDocumentGridPreview,
  parseDocumentGridPreview,
  previewFromPmJson
} from '../documentGridPreview'

const DOC_ID = 'docAbc123'

const doc = (content: unknown[]) => ({ type: 'doc', content })

const heading = (text: string, level = 1) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }]
})

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : []
})

const houseImage = (documentId: string) =>
  `https://rest.example/api/plugins/hypermultimedia/${documentId}/cover.png`

describe('previewFromPmJson', () => {
  test('empty doc', () => {
    expect(previewFromPmJson(doc([]), { documentId: DOC_ID })).toEqual(EMPTY_DOCUMENT_GRID_PREVIEW)
    expect(previewFromPmJson(null, { documentId: DOC_ID })).toEqual(EMPTY_DOCUMENT_GRID_PREVIEW)
    expect(previewFromPmJson({}, { documentId: DOC_ID })).toEqual(EMPTY_DOCUMENT_GRID_PREVIEW)
  })

  test('heading plus lines', () => {
    const preview = previewFromPmJson(
      doc([
        heading('Community plan'),
        paragraph('Get everyone on the same page before Friday.'),
        paragraph('Background is locked.'),
        paragraph(''),
        paragraph('Consultation is still open.'),
        paragraph('Fourth line stays.'),
        paragraph('This fifth line is dropped.')
      ]),
      { documentId: DOC_ID }
    )
    expect(preview.heading).toBe('Community plan')
    expect(preview.lines).toEqual([
      'Get everyone on the same page before Friday.',
      'Background is locked.',
      'Consultation is still open.',
      'Fourth line stays.'
    ])
  })

  test('keeps heading when it equals Title', () => {
    const preview = previewFromPmJson(doc([heading('Community plan'), paragraph('Body')]), {
      documentId: DOC_ID
    })
    expect(preview.heading).toBe('Community plan')
    expect(preview.lines).toEqual(['Body'])
  })

  test('list', () => {
    const preview = previewFromPmJson(
      doc([
        heading('Players'),
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [paragraph('Host')] },
            { type: 'listItem', content: [paragraph('Guest')] },
            { type: 'listItem', content: [paragraph('Scribe')] },
            { type: 'listItem', content: [paragraph('Dropped')] }
          ]
        }
      ]),
      { documentId: DOC_ID }
    )
    expect(preview.list).toEqual(['Host', 'Guest', 'Scribe'])
  })

  test('first same-document Image URL', () => {
    const src = houseImage(DOC_ID)
    const preview = previewFromPmJson(
      doc([
        heading('demo'),
        {
          type: 'image',
          attrs: { src }
        }
      ]),
      { documentId: DOC_ID }
    )
    expect(preview.imageSrc).toBe(src)
  })

  test('also accepts the /plugins house prefix', () => {
    const src = `https://rest.example/plugins/hypermultimedia/${DOC_ID}/cover.png`
    const preview = previewFromPmJson(doc([{ type: 'image', attrs: { src } }]), {
      documentId: DOC_ID
    })
    expect(preview.imageSrc).toBe(src)
  })

  test('omits foreign, javascript, data, and embed src', () => {
    const cases = [
      doc([
        {
          type: 'image',
          attrs: { src: 'https://rest.example/plugins/hypermultimedia/OTHER/file.png' }
        }
      ]),
      doc([{ type: 'image', attrs: { src: 'javascript:alert(1)' } }]),
      doc([{ type: 'image', attrs: { src: 'data:image/png;base64,xx' } }]),
      doc([{ type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9wg' } }])
    ]
    for (const json of cases) {
      expect(previewFromPmJson(json, { documentId: DOC_ID }).imageSrc).toBeUndefined()
    }
  })

  test('hostile heading is plain text after sanitize', () => {
    const preview = previewFromPmJson(
      doc([heading('<img src=x onerror=alert(1)>'), paragraph('a\nb\u0000c')]),
      { documentId: DOC_ID }
    )
    expect(preview.heading).toBe('<img src=x onerror=alert(1)>')
    expect(preview.lines).toEqual(['a bc'])
  })
})

describe('parseDocumentGridPreview', () => {
  test('null and undefined stay never-extracted', () => {
    expect(parseDocumentGridPreview(null)).toBeNull()
    expect(parseDocumentGridPreview(undefined)).toBeNull()
  })

  test('typed object passes through', () => {
    expect(
      parseDocumentGridPreview({
        heading: 'Plan',
        lines: ['Body'],
        list: ['One'],
        imageSrc: 'https://rest.example/plugins/hypermultimedia/docAbc123/a.png'
      })
    ).toEqual({
      heading: 'Plan',
      lines: ['Body'],
      list: ['One'],
      imageSrc: 'https://rest.example/plugins/hypermultimedia/docAbc123/a.png'
    })
  })

  test('empty or hostile values become the empty-doc object', () => {
    expect(parseDocumentGridPreview({})).toEqual(EMPTY_DOCUMENT_GRID_PREVIEW)
    expect(parseDocumentGridPreview([])).toEqual(EMPTY_DOCUMENT_GRID_PREVIEW)
    expect(parseDocumentGridPreview('x')).toEqual(EMPTY_DOCUMENT_GRID_PREVIEW)
    expect(parseDocumentGridPreview({ heading: 1, lines: [2, 'ok'] })).toEqual({
      heading: null,
      lines: ['ok']
    })
  })
})

describe('extractDocumentGridPreview', () => {
  test('empty ydoc', () => {
    const ydoc = new Y.Doc()
    const bytes = Y.encodeStateAsUpdate(ydoc)
    ydoc.destroy()
    expect(extractDocumentGridPreview(bytes, { documentId: DOC_ID })).toEqual(
      EMPTY_DOCUMENT_GRID_PREVIEW
    )
    expect(extractDocumentGridPreview(null, { documentId: DOC_ID })).toEqual(
      EMPTY_DOCUMENT_GRID_PREVIEW
    )
  })

  test('bad bytes return the empty-doc object', () => {
    expect(
      extractDocumentGridPreview(new Uint8Array([255, 0, 1, 2]), { documentId: DOC_ID })
    ).toEqual(EMPTY_DOCUMENT_GRID_PREVIEW)
  })
})
