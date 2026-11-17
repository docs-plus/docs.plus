import { describe, expect, test } from 'bun:test'

import { importDocx, TooManyImagesError } from '../../domain/docxImport'
import { MAX_IMPORT_IMAGES, MAX_TABLE_SPAN } from '../../types'
import { imageDocx, minimalDocx } from '../fixtures'

const run = (text: string) => `<w:r><w:t>${text}</w:t></w:r>`

const importBody = (body: string) =>
  importDocx(minimalDocx(body), {
    fallbackTitle: 'Fallback',
    uploadImage: async () => 'https://media.test/image.png'
  })

const warningCodes = async (body: string) =>
  (await importBody(body)).warnings.map((warning) => warning.code)

// mammoth reports neither revision, so a silent accept changes what a contract says.
describe('importDocx tracked changes', () => {
  test.each([
    ['an insertion', `<w:ins w:id="1" w:author="A">${run('new')}</w:ins>`],
    ['a deletion', '<w:del w:id="2" w:author="A"><w:r><w:delText>old</w:delText></w:r></w:del>'],
    ['a move out', `<w:moveFrom w:id="3" w:author="A">${run('old')}</w:moveFrom>`],
    ['a move in', `<w:moveTo w:id="4" w:author="A">${run('new')}</w:moveTo>`]
  ])('warns first on %s', async (_name, revision) => {
    const codes = await warningCodes(`<w:p>${run('Keep')}${revision}</w:p>`)
    expect(codes[0]).toBe('tracked-changes-accepted')
  })

  test('does not warn on a clean file', async () => {
    const codes = await warningCodes(`<w:p>${run('Plain')}</w:p>`)
    expect(codes).not.toContain('tracked-changes-accepted')
  })

  // These names start with a revision element's name.
  test('does not warn on table borders or move range marks', async () => {
    const codes = await warningCodes(
      `<w:tbl><w:tblPr><w:tblBorders><w:insideH w:val="single"/></w:tblBorders></w:tblPr><w:tr><w:tc><w:p>${run('Cell')}</w:p></w:tc></w:tr></w:tbl>` +
        `<w:p><w:moveFromRangeStart w:id="5" w:name="m"/>${run('After')}<w:moveFromRangeEnd w:id="5"/></w:p>`
    )
    expect(codes).not.toContain('tracked-changes-accepted')
  })
})

describe('importDocx table spans', () => {
  test('clamps a crafted gridSpan before it can be stored', async () => {
    const { content } = await importBody(
      `<w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="1000000"/></w:tcPr><w:p>${run('Cell')}</w:p></w:tc></w:tr></w:tbl>`
    )
    expect(JSON.stringify(content)).toContain(`"colspan":${MAX_TABLE_SPAN}`)
    expect(JSON.stringify(content)).not.toContain('1000000')
  })
})

// mammoth turns a throw in the image converter into a warning, so a cap that only
// threw there would still admit the file.
describe('importDocx image cap', () => {
  const importImages = async (count: number) => {
    let uploads = 0
    const result = importDocx(imageDocx(count), {
      fallbackTitle: 'Fallback',
      uploadImage: async () => `https://media.test/${++uploads}.png`
    })
    return { result, uploads: () => uploads }
  }

  // Alone each case takes under 0.1 s. After internalApply.test.ts in the same run, the
  // loop is slower and 512 images took 5.4 s, past the default 5 s timeout.
  const CAP_TIMEOUT_MS = 30_000

  test(
    'admits a file at the cap',
    async () => {
      const { result, uploads } = await importImages(MAX_IMPORT_IMAGES)
      await expect(result).resolves.toHaveProperty('content')
      expect(uploads()).toBe(MAX_IMPORT_IMAGES)
    },
    CAP_TIMEOUT_MS
  )

  test(
    'refuses a file past the cap, and uploads none past it',
    async () => {
      const { result, uploads } = await importImages(MAX_IMPORT_IMAGES + 1)
      await expect(result).rejects.toBeInstanceOf(TooManyImagesError)
      expect(uploads()).toBe(MAX_IMPORT_IMAGES)
    },
    CAP_TIMEOUT_MS
  )
})
