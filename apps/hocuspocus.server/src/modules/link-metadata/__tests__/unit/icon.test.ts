import { describe, expect, test } from 'bun:test'

import { sniffImageType } from '../../domain/icon'

// Pads a header to the 16-byte floor, so only the signature decides the answer.
const header = (...bytes: number[]): Uint8Array => {
  const out = new Uint8Array(Math.max(16, bytes.length))
  out.set(bytes)
  return out
}
const ascii = (text: string): number[] => [...Buffer.from(text, 'latin1')]

describe('sniffImageType', () => {
  test.each([
    ['PNG', header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'image/png'],
    ['ICO', header(0x00, 0x00, 0x01, 0x00, 0x01, 0x00), 'image/x-icon'],
    ['GIF87a', header(...ascii('GIF87a')), 'image/gif'],
    ['GIF89a', header(...ascii('GIF89a')), 'image/gif'],
    ['JPEG', header(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg'],
    ['WebP', header(...ascii('RIFF'), 0x24, 0x00, 0x00, 0x00, ...ascii('WEBP')), 'image/webp']
  ])('%s', (_name, bytes, type) => {
    expect(sniffImageType(bytes)).toBe(type)
  })

  test.each([
    ['SVG text', header(...ascii('<svg xmlns="http://www.w3.org/2000/svg">'))],
    ['HTML text', header(...ascii('<!doctype html><html>'))],
    ['a CUR header', header(0x00, 0x00, 0x02, 0x00, 0x01, 0x00)],
    ['an ICO header with an image count of 0', header(0x00, 0x00, 0x01, 0x00, 0x00, 0x00)],
    ['empty input', new Uint8Array(0)],
    ['15 bytes of PNG', header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a).subarray(0, 15)]
  ])('%s is a miss', (_name, bytes) => {
    expect(sniffImageType(bytes)).toBeNull()
  })
})
