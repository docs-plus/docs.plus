import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import type { ForeignImage } from '../../domain/documentHtml'
import { inlineExportImages, isSafeImageSignature } from '../../domain/inlineExportImages'

const chars = (text: string): number[] => [...text].map((char) => char.charCodeAt(0))

/** Pads to 32 bytes so a case fails on its signature, not on the length guard. */
const bytes = (...head: number[]): Uint8Array => {
  const out = new Uint8Array(32)
  out.set(head)
  return out
}

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

describe('isSafeImageSignature', () => {
  test('identifies png and jpeg', () => {
    expect(isSafeImageSignature(PNG)).toBe('image/png')
    expect(isSafeImageSignature(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
  })

  test('rejects the three parsers that loop forever', () => {
    expect(isSafeImageSignature(bytes(...chars('icns')))).toBeNull()
    expect(isSafeImageSignature(bytes(0x00, 0x00, 0x00, 0x18, ...chars('ftypheic')))).toBeNull()
    expect(isSafeImageSignature(bytes(0xff, 0x0a))).toBeNull()
  })

  // gif and webp decode fine but land in a DOCX part with no declared content
  // type; svg is declared and used to export, and is dropped on purpose.
  test('rejects everything else, including formats that used to export', () => {
    expect(isSafeImageSignature(bytes(...chars('GIF89a')))).toBeNull()
    expect(
      isSafeImageSignature(bytes(...chars('RIFF'), 0, 0, 0, 0, ...chars('WEBPVP8 ')))
    ).toBeNull()
    expect(isSafeImageSignature(bytes(...chars('<svg xmlns=')))).toBeNull()
    expect(isSafeImageSignature(bytes(0x42, 0x4d))).toBeNull()
  })

  test('rejects a buffer too short to carry a header', () => {
    expect(isSafeImageSignature(new Uint8Array(0))).toBeNull()
    expect(isSafeImageSignature(PNG.slice(0, 12))).toBeNull()
  })
})

// The cookie names the document owner, so a leak would hand another route a login.
describe('inlineExportImages media cookie', () => {
  const imageAt = (src: string): ForeignImage => ({
    getAttribute: () => src,
    setAttribute: () => {},
    remove: () => {}
  })
  let fetchSpy: ReturnType<typeof spyOn> | undefined
  afterEach(() => fetchSpy?.mockRestore())

  test('sends the cookie to the media route only', async () => {
    const sent = new Map<string, string | null>()
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      sent.set(String(input), new Headers(init?.headers).get('Cookie'))
      return new Response(PNG)
    }) as typeof fetch)
    const media = 'https://api.example.com/api/plugins/hypermultimedia/doc/a.png'
    const other = 'https://api.example.com/api/other/b.png'

    await inlineExportImages([imageAt(media), imageAt(other)], 'dp_media=signed')

    expect(sent.get(media)).toBe('dp_media=signed')
    expect(sent.get(other)).toBeNull()
  })
})
