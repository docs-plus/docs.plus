import { describe, expect, test } from 'bun:test'

import { createZip } from '../../domain/zipWriter'
import { ENTRY_COUNT_MISMATCH, PART_TOO_LARGE, zipInflateSize } from '../../domain/zipInflateSize'

const BUDGET = 64 * 1024
const PART_BUDGET = 4 * 1024
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
      name: 'refuses a word/*.xml part over the part budget',
      zip: () => createZip([{ name: 'word/document.xml', data: 'x'.repeat(PART_BUDGET + 1) }]),
      expected: PART_TOO_LARGE
    },
    {
      name: 'refuses a stored word/*.xml part over the part budget',
      zip: () =>
        createZip([{ name: 'word/footnotes.xml', data: 'x'.repeat(PART_BUDGET + 1), store: true }]),
      expected: PART_TOO_LARGE
    },
    {
      name: 'admits a word/*.xml part at the part budget',
      zip: () => createZip([{ name: 'word/document.xml', data: 'x'.repeat(PART_BUDGET) }]),
      expected: PART_BUDGET
    },
    {
      // mammoth never holds media or rels as one string, so only the total budget applies.
      name: 'leaves parts outside word/*.xml to the total budget',
      zip: () => createZip([{ name: 'word/media/a.xml', data: 'x'.repeat(PART_BUDGET + 1) }]),
      expected: PART_BUDGET + 1
    },
    {
      name: 'returns null with no EOCD record',
      zip: () => Buffer.from('PK\x03\x04 no end'),
      expected: null
    }
  ]

  for (const row of rows) {
    test(row.name, () => {
      expect(zipInflateSize(row.zip(), BUDGET, PART_BUDGET)).toBe(row.expected)
    })
  }

  test('stops at the budget, whatever the declared size says', () => {
    const zip = createZip([{ name: 'word/document.xml', data: '0'.repeat(BUDGET * 4) }])
    const result = zipInflateSize(zip, BUDGET, BUDGET * 8)
    expect(typeof result === 'number' && result > BUDGET).toBe(true)
  })
})
