import { beforeEach, describe, expect, mock, test } from 'bun:test'

import * as realSupabase from '../../../../lib/supabase'

// Do NOT mock `lib/auth`: the real requireUser must verify the token.
mock.module('../../../../lib/supabase', () => ({
  ...realSupabase,
  getAnonClient: () => ({ auth: { getUser: stubGetUser } }),
  getServiceRoleClient: () => null
}))

import { TiptapTransformer } from '@hocuspocus/transformer'
import { Hono } from 'hono'
import type { Logger } from 'pino'
import * as Y from 'yjs'

import { createMockPrisma, stubGetUser, TestServer } from '../../../../../tests/helpers/test-server'
import { migrationExtensions } from '../../../../lib/migration-extensions'
import { createRouter } from '../../http/router'
import { MAX_IMPORT_BYTES } from '../../types'
import { minimalDocx } from '../fixtures'

const DOCUMENT_ID = 'abcdefghij123456789'
const NON_OWNER = { Authorization: 'Bearer other-user-token' }
const OWNER = { Authorization: 'Bearer valid-test-token' }

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const privateMeta = {
  slug: 'garden',
  ownerId: 'user-123',
  deletedAt: null,
  isPrivate: true,
  readOnly: false
}

// requireServiceRoleOrUser answers a signed-out call with 401 before deny() runs,
// so only a signed-in non-owner proves the controller's access check.
describe('Document conversion routes — a non-owner on a Private document', () => {
  let server: TestServer

  beforeEach(() => {
    const prisma = createMockPrisma() as any
    prisma.documentMetadata.findUnique = async () => privateMeta
    const app = new Hono()
    app.route(
      '/api/documents',
      createRouter({
        prisma,
        logger: silentLogger,
        mediaPublicBaseUrl: null,
        mediaCookieFor: () => null
      })
    )
    server = new TestServer(app)
  })

  for (const format of ['docx', 'md', 'odt']) {
    test(`export as ${format} gets 403`, async () => {
      const response = await server.get(
        `/api/documents/${DOCUMENT_ID}/export?format=${format}`,
        NON_OWNER
      )
      expect(response.status).toBe(403)
      expect((await response.json()).error).toHaveProperty('code', 'FORBIDDEN')
    })
  }

  test('import gets 403', async () => {
    const response = await server.upload(
      `/api/documents/${DOCUMENT_ID}/import`,
      new File(['# Garden\n\nText'], 'garden.md', { type: 'text/markdown' }),
      'documentFile',
      NON_OWNER
    )
    expect(response.status).toBe(403)
    expect((await response.json()).error).toHaveProperty('code', 'FORBIDDEN')
  })
})

const errorOf = async (response: Pick<Response, 'json'>): Promise<unknown> =>
  ((await response.json()) as { error: unknown }).error

const docxFile = (body: string, padding?: Uint8Array): File =>
  new File(
    [
      minimalDocx(
        body,
        // An unreferenced stored part: it sets the upload size without adding content.
        padding ? [{ name: 'word/media/padding.bin', data: padding, store: true }] : []
      )
    ],
    'garden.docx'
  )

// The cap follows the stored ownerId, and the result guards run for every caller (#722).
describe('Document conversion import — caps and size guards', () => {
  let app: Hono

  beforeEach(() => {
    const prisma = createMockPrisma() as any
    prisma.documentMetadata.findUnique = async () => ({ ...privateMeta, isPrivate: false })
    app = new Hono()
    app.route(
      '/api/documents',
      createRouter({
        prisma,
        logger: silentLogger,
        mediaPublicBaseUrl: null,
        mediaCookieFor: () => null
      })
    )
  })

  // An in-process request carries no Content-Length, so this one sets it, as a browser does.
  const importFile = async (file: File, headers: Record<string, string>) => {
    const form = new FormData()
    form.append('documentFile', file)
    const encoded = new Request('http://local/', { method: 'POST', body: form })
    const contentType = encoded.headers.get('content-type') ?? ''
    const body = await encoded.arrayBuffer()
    return app.request(`/api/documents/${DOCUMENT_ID}/import`, {
      method: 'POST',
      body,
      headers: {
        ...headers,
        'content-type': contentType,
        'content-length': String(body.byteLength)
      }
    })
  }

  const overNonOwnerCap = () =>
    docxFile('<w:p><w:r><w:t>Garden</w:t></w:r></w:p>', new Uint8Array(MAX_IMPORT_BYTES + 1024))

  test('a Word file over the 10 MiB cap passes for the owner and is refused for anyone else', async () => {
    const owner = await importFile(overNonOwnerCap(), OWNER)
    expect(owner.status).toBe(200)

    const other = await importFile(overNonOwnerCap(), NON_OWNER)
    expect(other.status).toBe(413)
    expect(await errorOf(other)).toHaveProperty('code', 'PAYLOAD_TOO_LARGE')
  })

  // A stream has no Content-Length, as a chunked body does. The bytes are not valid
  // multipart, so only the body limit can answer 413 here: a parse would answer 400.
  test('a body with no Content-Length is refused at the caller cap as it arrives', async () => {
    const chunk = new Uint8Array(1024 * 1024)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > MAX_IMPORT_BYTES + 2 * chunk.length) return controller.close()
        sent += chunk.length
        controller.enqueue(chunk)
      }
    })
    const response = await app.request(`/api/documents/${DOCUMENT_ID}/import`, {
      method: 'POST',
      body,
      headers: { ...NON_OWNER, 'content-type': 'multipart/form-data; boundary=garden' }
    })
    expect(response.status).toBe(413)
    expect(await errorOf(response)).toHaveProperty('code', 'PAYLOAD_TOO_LARGE')
  })

  test('Markdown that nests past the depth cap is refused', async () => {
    const markdown = `# Garden\n\n${'>'.repeat(500)} text\n`
    const response = await importFile(new File([markdown], 'garden.md'), OWNER)
    expect(response.status).toBe(413)
    expect(await errorOf(response)).toHaveProperty('code', 'TOO_DEEP')
  })

  test('adversarial 5000-deep Markdown returns 413 TOO_DEEP and fenced deep markers still import as 200', async () => {
    const deep = `${'> '.repeat(5000)}hi`
    const deepPayloads = [
      `# Garden\n\n${deep}\n`,
      `hi\r${deep}`,
      `- a\n  \`\`\`\n     \`\`\`\n  ${deep}`,
      `- a\nlazy\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `-\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `1. a\n   \`\`\`\n  foo\n  \`\`\`\n  ${deep}`,
      `1. a\n   \`\`\`\n   2. b\n   ${deep}`,
      `<div>\n\`\`\`\n\n${deep}`,
      `- <div>\n  \`\`\`\n\n  ${deep}`,
      `- [ ] a\n\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `1. a\n\n\tx\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `1000. a\n\n     <pre>\n  \`\`\`\n     </pre>\n  ${deep}`,
      `para\n<custom-widget>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `para\n[a\n\`\`\`\n]: https://example.test\n\`\`\`\n${deep}`,
      `[a]: https://example.test "foo\n\`\`\`\n" extra\n\`\`\`\n${deep}`,
      `\`\`\`\n\`\`\`\n<custom>\n\`\`\`\n\n${deep}`,
      `- a\n---\t\n   \`\`\`\n${deep}`,
      `>     code\n<custom>\n\`\`\`\n\n${deep}`,
      `| a | b |\n| --- | --- |\n    code\n<custom>\n\`\`\`\n\n${deep}`,
      `<? ?> ${deep}`,
      `<!DOCTYPE\n> \`\`\`\n   \`\`\`\n${deep}`,
      `<!doctype\n> - a\n   \`\`\`\n${deep}`,
      `<precustom>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`,
      `</foo\n\n>\n\`\`\`\n\n${deep}`,
      `| a | b |\n| --- | --- |\n\t \n<custom>\n\`\`\`\n\n${deep}`,
      `| \`a|b\` | c |\n| --- | --- |\n| 1 | 2 |\n\`\`\`\n\`\`\`\n\`\`\`\n${deep}`,
      `10. a\n\n x\n<custom>\n\`\`\`\n\n${deep}`,
      `- [ ] a\n x\n<custom>\n\`\`\`\n\n${deep}`,
      `- [ ] a\n\n x\n[a]:\n\`\`\`\n${deep}`,
      `1. a\n \t\n<!DOCTYPE\n\`\`\`\t\n${deep}`,
      `> - a\n>\t\tcode\n[a]:\n\`\`\`\`\n\`\`\`\`\n${deep}`,
      `> 1. a\n> > - a\n[a]:\n\`\`\`ts\n${deep}`,
      `  x\n2. a\n--- | ---\n   \`\`\`\n-\t\n${deep}`,
      `  - [ ] a\n   \`\`\`\n\tx\n   ${deep}`,
      `| \` \`\` \`\`\` \`\`\`\` \`\`\`\`\` \`\`\`\`\`\` \`a|b\` \`c|d\` \`e|f\` | x |\n| --- | --- |\n\`\`\`\n\`\`\`\n\`\`\`\n${deep}`,
      `x | a | b |\n| --- | --- |\n    \u00A0\n<custom>\n\`\`\`\n\n${deep}`,
      `x- [ ] a\n x\n<custom>\n\`\`\`\n\n${deep}`,
      `1.\n| \`a|b\` | c |\n| --- | --- |\n~~~~~\n${deep}`,
      `para\n> a\n<!DOCTYPE > ${deep}`,
      `    - a\n| \`a|b\` | c |\n| --- | --- |\n\`\`\`ts\n${deep}`,
      `| a | b |\n| --- | --- |\n1.\n</foo\n\t\n>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`,
      `- a\n<precustom>\n| \`a|b\` | c |\n| --- | --- |\n\`\`\`\n${deep}`,
      `1000. a\n\n     <pre>\n[a]:\n\`\`\`\n${deep}`
    ]
    for (const payload of deepPayloads) {
      const refused = await importFile(new File([payload], 'deep.md'), OWNER)
      expect(refused.status).toBe(413)
      expect(await errorOf(refused)).toHaveProperty('code', 'TOO_DEEP')
    }

    const fencedPayloads = [
      `# Garden\n\n\`\`\`\n${'> '.repeat(100)}hi\n\`\`\`\n`,
      `# Garden\n\n> quote\n\`\`\`\n${'> '.repeat(100)}hi\n\`\`\`\n`,
      `# Garden\n\n<precustom>\n\`\`\`\n${'> '.repeat(100)}hi\n\`\`\`\n`,
      `# Garden\n\n| \`a|b\` | c |\n| --- | --- |\n| 1 | 2 |\n\n\`\`\`\n${'> '.repeat(100)}hi\n\`\`\`\n`,
      `# Garden\n\n  x\n2. a\n--- | ---\n  \`\`\`\n  ${'> '.repeat(100)}hi\n  \`\`\`\n`,
      `# Garden\n\nx- [ ] a\n\n\`\`\`\n${'> '.repeat(100)}hi\n\`\`\`\n`
    ]
    for (const fenced of fencedPayloads) {
      const accepted = await importFile(new File([fenced], 'fenced.md'), OWNER)
      expect(accepted.status).toBe(200)
    }
  })

  // The Word tag limit binds first on Word files, so a Markdown table reaches the node cap.
  test('an import that converts past the node cap is refused', async () => {
    const row = `${'|a'.repeat(100)}|\n`
    const markdown = `${row}${'|-'.repeat(100)}|\n${row.repeat(300)}`
    const response = await importFile(new File([markdown], 'garden.md'), OWNER)
    expect(response.status).toBe(413)
    expect(await errorOf(response)).toHaveProperty('code', 'TOO_MANY_NODES')
  })

  test('a Word file past the paragraph and run tag limit is refused before the parse', async () => {
    const response = await importFile(
      docxFile('<w:p><w:r><w:t>a</w:t></w:r></w:p>'.repeat(7_251)),
      OWNER
    )
    expect(response.status).toBe(413)
    expect(await errorOf(response)).toHaveProperty('code', 'WORD_TOO_MANY_TAGS')
  })

  test('a Word file over the 2.5 MiB Word parts cap is refused before the parse', async () => {
    const paragraph = `<w:p><w:r><w:t>${'word '.repeat(2000)}</w:t></w:r></w:p>`
    const response = await importFile(docxFile(paragraph.repeat(330)), OWNER)
    expect(response.status).toBe(413)
    expect(await errorOf(response)).toHaveProperty('code', 'WORD_PART_TOO_LARGE')
  })

  // The Word parts cap keeps `document.xml` small, so the bulk sits in one long link target
  // in the rels part, and every link mark repeats it in the Yjs state.
  test('a Word file whose content would not load in a browser is refused', async () => {
    const link =
      '<w:p><w:hyperlink r:id="rIdLink" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:r><w:t>a</w:t></w:r></w:hyperlink></w:p>'
    const target = `https://example.com/${'a'.repeat(64 * 1024)}`
    const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${target}" TargetMode="External"/></Relationships>`
    const file = new File(
      [minimalDocx(link.repeat(250), [{ name: 'word/_rels/document.xml.rels', data: rels }])],
      'garden.docx'
    )
    const response = await importFile(file, OWNER)
    expect(response.status).toBe(413)
    expect(await errorOf(response)).toHaveProperty('code', 'TOO_LARGE_TO_OPEN')
  })
})

const makeSnapshot = (title: string, bodyText: string): Uint8Array => {
  const ydoc = TiptapTransformer.toYdoc(
    {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
        { type: 'paragraph', content: [{ type: 'text', text: bodyText }] }
      ]
    },
    'default',
    migrationExtensions
  )
  const update = Y.encodeStateAsUpdate(ydoc)
  ydoc.destroy()
  return update
}

describe('GET /api/documents/:slug/markdown (#822)', () => {
  const mountMarkdownApp = (prisma: any) => {
    const app = new Hono()
    app.route(
      '/api/documents',
      createRouter({
        prisma,
        logger: silentLogger,
        mediaPublicBaseUrl: null,
        mediaCookieFor: () => null
      })
    )
    return new TestServer(app)
  }

  test('returns 200 text/markdown with required headers for a public persisted document', async () => {
    const prisma = createMockPrisma() as any
    const snapshot = makeSnapshot('Garden Notes', 'Hello from public markdown.')
    prisma.documentMetadata.findUnique = async () => ({
      documentId: DOCUMENT_ID,
      isPrivate: false,
      readOnly: false,
      ownerId: 'user-123',
      deletedAt: null
    })
    prisma.$queryRaw = async () => [{ version: 3, data: snapshot }]

    const server = mountMarkdownApp(prisma)
    const response = await server.get('/api/documents/Garden-Notes/markdown')
    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('vary')).toBe('Accept')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-length')).toBe(String(Buffer.byteLength(text, 'utf8')))
    expect(text).toContain('# Garden Notes')
    expect(text).toContain('Hello from public markdown.')
  })

  test('fails closed with identical 404 and zero drafts for Private, trashed, missing, and unpersisted docs', async () => {
    const cases = [
      {
        label: 'private (even with owner token)',
        meta: {
          documentId: DOCUMENT_ID,
          isPrivate: true,
          readOnly: false,
          ownerId: 'user-123',
          deletedAt: null
        },
        rows: [{ version: 1, data: makeSnapshot('Secret', 'Never leak') }],
        headers: OWNER
      },
      {
        label: 'trashed',
        meta: {
          documentId: DOCUMENT_ID,
          isPrivate: false,
          readOnly: false,
          ownerId: 'user-123',
          deletedAt: new Date()
        },
        rows: [{ version: 1, data: makeSnapshot('Gone', 'Deleted') }],
        headers: {}
      },
      {
        label: 'missing',
        meta: null,
        rows: [],
        headers: {}
      },
      {
        label: 'unpersisted version (metadata only)',
        meta: {
          documentId: DOCUMENT_ID,
          isPrivate: false,
          readOnly: false,
          ownerId: null,
          deletedAt: null
        },
        rows: [],
        headers: {}
      }
    ]

    const bodies: unknown[] = []
    for (const c of cases) {
      const prisma = createMockPrisma() as any
      let draftCreated = false
      prisma.documentMetadata.findUnique = async () => c.meta
      prisma.documentMetadata.create = async () => {
        draftCreated = true
        return {}
      }
      prisma.$queryRaw = async () => c.rows

      const server = mountMarkdownApp(prisma)
      const response = await server.get('/api/documents/some-slug/markdown', c.headers)
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toHaveProperty('code', 'NOT_FOUND')
      expect(draftCreated).toBe(false)
      bodies.push(body)
    }

    // All four failure modes are indistinguishable (no Private-document existence oracle).
    for (const body of bodies.slice(1)) {
      expect(body).toEqual(bodies[0])
    }
  })

  test('returns 413 PAYLOAD_TOO_LARGE without decoding when head exceeds 1 MiB', async () => {
    const prisma = createMockPrisma() as any
    prisma.documentMetadata.findUnique = async () => ({
      documentId: DOCUMENT_ID,
      isPrivate: false,
      readOnly: false,
      ownerId: null,
      deletedAt: null
    })
    // Mirrors SQL `CASE WHEN octet_length(data) <= 1048576 THEN data END AS data` returning null.
    prisma.$queryRaw = async () => [{ version: 2, data: null }]

    const server = mountMarkdownApp(prisma)
    const response = await server.get('/api/documents/huge-doc/markdown')
    const body = await response.json()

    expect(response.status).toBe(413)
    expect(body.error).toHaveProperty('code', 'PAYLOAD_TOO_LARGE')
  })

  test('coalesces concurrent reads of the same hot document via single-flight', async () => {
    const prisma = createMockPrisma() as any
    const snapshot = makeSnapshot('Hot Pad', 'Shared flight body.')
    prisma.documentMetadata.findUnique = async () => ({
      documentId: DOCUMENT_ID,
      isPrivate: false,
      readOnly: false,
      ownerId: 'user-123',
      deletedAt: null
    })

    let headReads = 0
    let releaseRead!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseRead = resolve
    })
    prisma.$queryRaw = async () => {
      headReads += 1
      await gate
      return [{ version: 1, data: snapshot }]
    }

    const server = mountMarkdownApp(prisma)
    const inflight = [
      server.get('/api/documents/hot-pad/markdown'),
      server.get('/api/documents/hot-pad/markdown'),
      server.get('/api/documents/hot-pad/markdown')
    ]
    // Let all three reach the single-flight before resolving the DB query.
    await new Promise((resolve) => setTimeout(resolve, 10))
    releaseRead()

    const responses = await Promise.all(inflight)
    const texts = await Promise.all(responses.map((r) => r.text()))

    expect(headReads).toBe(1)
    for (const r of responses) {
      expect(r.status).toBe(200)
    }
    for (const text of texts) {
      expect(text).toContain('# Hot Pad')
      expect(text).toContain('Shared flight body.')
    }
  })
})
