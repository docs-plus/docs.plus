import { describe, expect, test } from 'bun:test'

import { createZip } from '../../domain/zipWriter'
import {
  ENTRY_COUNT_MISMATCH,
  PART_TOO_LARGE,
  TOO_MANY_TAGS,
  zipInflateSize
} from '../../domain/zipInflateSize'

const BUDGET = 64 * 1024
const WORD_BUDGET = 4 * 1024
const TAG_BUDGET = 10
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

// Two counted tags. The properties tags start with `<w:p` and `<w:r` too, and must not count.
const FORMATTED = '<w:p><w:pPr/><w:r><w:rPr><w:b/></w:rPr><w:t>a</w:t></w:r></w:p>'

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
      name: 'refuses a word/*.xml part over the word budget',
      zip: () => createZip([{ name: 'word/document.xml', data: 'x'.repeat(WORD_BUDGET + 1) }]),
      expected: PART_TOO_LARGE
    },
    {
      // Each part fits alone; four such parts added 311 MiB in a 512M container (#577).
      name: 'refuses word/*.xml parts that only together pass the word budget',
      zip: () =>
        createZip([
          { name: 'word/document.xml', data: 'x'.repeat(WORD_BUDGET / 2) },
          { name: 'word/footnotes.xml', data: 'y'.repeat(WORD_BUDGET / 2 + 1) }
        ]),
      expected: PART_TOO_LARGE
    },
    {
      name: 'refuses a stored word/*.xml part over the word budget',
      zip: () =>
        createZip([{ name: 'word/footnotes.xml', data: 'x'.repeat(WORD_BUDGET + 1), store: true }]),
      expected: PART_TOO_LARGE
    },
    {
      name: 'admits word/*.xml parts that sum to the word budget',
      zip: () =>
        createZip([
          { name: 'word/document.xml', data: 'x'.repeat(WORD_BUDGET / 2) },
          { name: 'word/footnotes.xml', data: 'y'.repeat(WORD_BUDGET / 2) }
        ]),
      expected: WORD_BUDGET
    },
    {
      // mammoth never holds media or rels as one string, so only the total budget applies.
      name: 'leaves parts outside word/*.xml to the total budget',
      zip: () => createZip([{ name: 'word/media/a.xml', data: 'x'.repeat(WORD_BUDGET + 1) }]),
      expected: WORD_BUDGET + 1
    },
    {
      // One-letter paragraphs added 337 MiB in a 512M container at 2.5 MiB (#577).
      name: 'refuses word/*.xml parts past the tag budget, whatever ends the tag name',
      zip: () =>
        createZip([
          {
            name: 'word/document.xml',
            data: `${FORMATTED.repeat(4)}<w:p w:rsidR="00"><w:r\n><w:t>a</w:t></w:r></w:p><w:p/>`
          }
        ]),
      expected: TOO_MANY_TAGS
    },
    {
      name: 'admits word/*.xml parts at the tag budget, without counting pPr or rPr',
      zip: () => createZip([{ name: 'word/document.xml', data: FORMATTED.repeat(5) }]),
      expected: FORMATTED.length * 5
    },
    {
      // mammoth reads namespaces, so another prefix or a default namespace is still a paragraph.
      name: 'counts paragraph and run tags under any prefix, or none',
      zip: () =>
        createZip([
          {
            name: 'word/document.xml',
            data: `${'<x:p><x:r><x:t>a</x:t></x:r></x:p>'.repeat(3)}${'<p><r/></p>'.repeat(3)}`
          }
        ]),
      expected: TOO_MANY_TAGS
    },
    {
      name: 'refuses tags that only together pass the tag budget, stored or deflated',
      zip: () =>
        createZip([
          { name: 'word/document.xml', data: FORMATTED.repeat(3) },
          { name: 'word/footnotes.xml', data: FORMATTED.repeat(3), store: true }
        ]),
      expected: TOO_MANY_TAGS
    },
    {
      name: 'leaves tags outside word/*.xml uncounted',
      zip: () => createZip([{ name: 'word/glossary/document.xml', data: FORMATTED.repeat(6) }]),
      expected: FORMATTED.length * 6
    },
    {
      name: 'returns null with no EOCD record',
      zip: () => Buffer.from('PK\x03\x04 no end'),
      expected: null
    }
  ]

  for (const row of rows) {
    test(row.name, () => {
      expect(zipInflateSize(row.zip(), BUDGET, WORD_BUDGET, TAG_BUDGET)).toBe(row.expected)
    })
  }

  test('stops at the budget, whatever the declared size says', () => {
    const zip = createZip([{ name: 'word/document.xml', data: '0'.repeat(BUDGET * 4) }])
    const result = zipInflateSize(zip, BUDGET, BUDGET * 8, TAG_BUDGET)
    expect(typeof result === 'number' && result > BUDGET).toBe(true)
  })
})
