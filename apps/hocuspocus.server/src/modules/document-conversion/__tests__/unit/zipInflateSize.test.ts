import { describe, expect, test } from 'bun:test'

import { createZip } from '../../domain/zipWriter'
import { ENTRY_COUNT_MISMATCH, zipInflateSize } from '../../domain/zipInflateSize'

const BUDGET = 64 * 1024
const EOCD_BYTES = 22

const archive = () =>
  createZip([
    { name: 'a.xml', data: 'x'.repeat(1000) },
    { name: 'b.bin', data: 'stored bytes', store: true },
    { name: 'c.xml', data: 'y'.repeat(2000) }
  ])

// createZip writes no comment, so the EOCD record is the last 22 bytes.
const patchEocd = (zip: Buffer, offset: number, value: number): Buffer => {
  zip.writeUInt16LE(value, zip.length - EOCD_BYTES + offset)
  return zip
}

const centralDirectory = (zip: Buffer) => zip.readUInt32LE(zip.length - EOCD_BYTES + 16)

describe('zipInflateSize', () => {
  const rows: { name: string; zip: () => Buffer; expected: ReturnType<typeof zipInflateSize> }[] = [
    { name: 'measures every entry', zip: archive, expected: 1000 + 12 + 2000 },
    {
      name: 'refuses when the two EOCD counts differ',
      zip: () => patchEocd(archive(), 8, 2),
      expected: ENTRY_COUNT_MISMATCH
    },
    {
      // Both counts hide the last entry, which is where a bomb would sit.
      name: 'refuses when both counts are below the walked count',
      zip: () => patchEocd(patchEocd(archive(), 8, 2), 10, 2),
      expected: ENTRY_COUNT_MISMATCH
    },
    {
      name: 'refuses when both counts are above the walked count',
      zip: () => patchEocd(patchEocd(archive(), 8, 4), 10, 4),
      expected: ENTRY_COUNT_MISMATCH
    },
    {
      name: 'returns null for a method it cannot measure',
      zip: () => {
        const zip = archive()
        zip.writeUInt16LE(12, centralDirectory(zip) + 10)
        return zip
      },
      expected: null
    },
    {
      name: 'returns null with no EOCD record',
      zip: () => Buffer.from('PK\x03\x04 no end'),
      expected: null
    }
  ]

  for (const row of rows) {
    test(row.name, () => {
      expect(zipInflateSize(row.zip(), BUDGET)).toBe(row.expected)
    })
  }

  test('stops at the budget, whatever the declared size says', () => {
    const zip = createZip([{ name: 'word/document.xml', data: '0'.repeat(BUDGET * 4) }])
    const result = zipInflateSize(zip, BUDGET)
    expect(typeof result === 'number' && result > BUDGET).toBe(true)
  })
})
