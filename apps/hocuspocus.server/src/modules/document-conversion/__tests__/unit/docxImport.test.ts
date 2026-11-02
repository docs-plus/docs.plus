import { describe, expect, test } from 'bun:test'

import { importDocx } from '../../domain/docxImport'
import { createZip } from '../../domain/zipWriter'
import { MAX_TABLE_SPAN } from '../../types'

const docx = (body: string): Buffer =>
  createZip([
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    },
    {
      name: 'word/document.xml',
      data: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
    }
  ])

const run = (text: string) => `<w:r><w:t>${text}</w:t></w:r>`

const importBody = (body: string) =>
  importDocx(docx(body), {
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
