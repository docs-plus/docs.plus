import { describe, expect, test } from 'bun:test'

import { renderDocumentHtml } from '../../domain/documentHtml'
import { MAX_TABLE_SPAN, type TiptapDocJson } from '../../types'

const tableWithCell = (colspan: unknown, content: unknown[]): TiptapDocJson =>
  ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [{ type: 'tableCell', attrs: { colspan, rowspan: 1 }, content }]
          }
        ]
      }
    ]
  }) as TiptapDocJson

const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }

const countCols = (html: string) => html.match(/<col[\s/>]/g)?.length ?? 0

// The renderer writes one `<col>` per span, so one stored value can kill the REST process.
describe('toPortableJson table spans', () => {
  test.each([
    ['a number', 10_000],
    ['a string', '10000']
  ])('limits the columns a stored colspan of %s renders', async (_name, colspan) => {
    const html = await renderDocumentHtml(tableWithCell(colspan, [paragraph]), 'T', null, null)
    expect(countCols(html)).toBe(MAX_TABLE_SPAN)
  })

  test('leaves a normal colspan alone', async () => {
    const html = await renderDocumentHtml(tableWithCell(2, [paragraph]), 'T', null, null)
    expect(html).toContain('colspan="2"')
  })

  // A clamped cell is a swapped node, and a writer cannot render an embed.
  test('still rewrites an embed inside a clamped cell', async () => {
    const src = 'https://www.youtube.com/watch?v=abc'
    const html = await renderDocumentHtml(
      tableWithCell(10_000, [
        { type: 'youtube', attrs: { src } },
        { type: 'mediaUploadPlaceholder' }
      ]),
      'T',
      null,
      null
    )
    expect(html).toContain(`href="${src}"`)
  })
})
