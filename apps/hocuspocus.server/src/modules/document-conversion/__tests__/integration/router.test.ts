import { beforeEach, describe, expect, mock, test } from 'bun:test'

import * as realSupabase from '../../../../lib/supabase'

// Do NOT mock `lib/auth`: the real requireUser must verify the token.
mock.module('../../../../lib/supabase', () => ({
  ...realSupabase,
  getAnonClient: () => ({ auth: { getUser: stubGetUser } }),
  getServiceRoleClient: () => null
}))

import { Hono } from 'hono'
import type { Logger } from 'pino'

import { createMockPrisma, stubGetUser, TestServer } from '../../../../../tests/helpers/test-server'
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

  test('a Word file that converts past the node cap is refused', async () => {
    const response = await importFile(
      docxFile('<w:p><w:r><w:t>a</w:t></w:r></w:p>'.repeat(25_001)),
      OWNER
    )
    expect(response.status).toBe(413)
    expect(await errorOf(response)).toHaveProperty('code', 'TOO_MANY_NODES')
  })

  test('a Word file whose content would not load in a browser is refused', async () => {
    const paragraph = `<w:p><w:r><w:t>${'word '.repeat(2000)}</w:t></w:r></w:p>`
    const response = await importFile(docxFile(paragraph.repeat(1300)), OWNER)
    expect(response.status).toBe(413)
    expect(await errorOf(response)).toHaveProperty('code', 'TOO_LARGE_TO_OPEN')
  })
})
