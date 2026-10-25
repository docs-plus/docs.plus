import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import mammoth from 'mammoth'

import { exportDocx } from '../../domain/docxExport'
import type { TiptapDocJson } from '../../types'

// A real 1x1 PNG. The converter measures the image, so a bare signature is not enough.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

const imageParagraph = (src: string) => ({
  type: 'paragraph',
  content: [{ type: 'image', attrs: { src } }]
})

// Image src is pad content any editor can set. The origin allowlist is the only
// guard between a service-role export and an internal address.
describe('exportDocx image origin allowlist', () => {
  let mediaHits = 0
  let foreignHits = 0
  let media: ReturnType<typeof Bun.serve>
  let foreign: ReturnType<typeof Bun.serve>

  beforeAll(() => {
    media = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () => {
        mediaHits += 1
        return new Response(PNG, { headers: { 'content-type': 'image/png' } })
      }
    })
    foreign = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () => {
        foreignHits += 1
        return new Response(PNG, { headers: { 'content-type': 'image/png' } })
      }
    })
  })

  afterAll(() => {
    media.stop(true)
    foreign.stop(true)
  })

  test('fetches only the media origin and inlines its image', async () => {
    const mediaOrigin = `http://127.0.0.1:${media.port}`
    const doc: TiptapDocJson = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'T' }] },
        imageParagraph(`${mediaOrigin}/media/a.png`),
        imageParagraph(`http://127.0.0.1:${foreign.port}/latest/b.png`)
      ]
    }

    const docx = await exportDocx(doc, 'T', mediaOrigin, null)

    expect(foreignHits).toBe(0)
    expect(mediaHits).toBe(1)
    // Zip entry names are not compressed, so a byte search finds the media part.
    expect(docx.includes('word/media/')).toBe(true)

    const inlined: Buffer[] = []
    await mammoth.convertToHtml(
      { buffer: docx },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          inlined.push(await image.readAsBuffer())
          return { src: '' }
        })
      }
    )
    expect(inlined).toHaveLength(1)
    expect(Buffer.compare(inlined[0], PNG)).toBe(0)
  })
})
