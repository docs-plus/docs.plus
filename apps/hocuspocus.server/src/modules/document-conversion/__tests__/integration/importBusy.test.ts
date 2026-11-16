import { afterEach, describe, expect, mock, test } from 'bun:test'

import * as realSupabase from '../../../../lib/supabase'
import * as realDocxImport from '../../domain/docxImport'

const realImportDocx = realDocxImport.importDocx
// Pass-through unless a test sets it, so other suites in this process keep the real parse.
let importDocxHook: typeof realImportDocx | null = null

mock.module('../../../../lib/supabase', () => ({
  ...realSupabase,
  getAnonClient: () => ({ auth: { getUser: stubGetUser } }),
  getServiceRoleClient: () => null
}))
mock.module('../../domain/docxImport', () => ({
  ...realDocxImport,
  importDocx: (...args: Parameters<typeof realImportDocx>) =>
    (importDocxHook ?? realImportDocx)(...args)
}))

import { Hono } from 'hono'
import type { Logger } from 'pino'

import { createMockPrisma, stubGetUser, TestServer } from '../../../../../tests/helpers/test-server'
import { createRouter } from '../../http/router'
import type { ImportResult } from '../../types'
import { minimalDocx } from '../fixtures'

const DOCUMENT_ID = 'abcdefghij123456789'
const OWNER = { Authorization: 'Bearer valid-test-token' }

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const createServer = () => {
  const prisma = createMockPrisma() as any
  prisma.documentMetadata.findUnique = async () => ({
    slug: 'garden',
    ownerId: 'user-123',
    deletedAt: null,
    isPrivate: false,
    readOnly: false
  })
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

const upload = (server: TestServer, bytes: Buffer) =>
  server.upload(
    `/api/documents/${DOCUMENT_ID}/import`,
    new File([bytes], 'garden.docx'),
    'documentFile',
    OWNER
  )

const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`
// 40 MiB of Word text deflates to about 306 KiB: small upload, large parse.
const heavyDocx = () =>
  minimalDocx(paragraph('Water early, mulch after rain. '.repeat(40)).repeat(32 * 1024))

const result: ImportResult = {
  content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [] }] },
  title: 'Garden',
  warnings: []
}

describe('Document import — one at a time per process', () => {
  afterEach(() => {
    importDocxHook = null
  })

  test('a second import while one runs gets 503 IMPORT_BUSY, then the slot frees', async () => {
    let started!: () => void
    const running = new Promise<void>((resolve) => (started = resolve))
    let finish!: (value: ImportResult) => void
    importDocxHook = () => {
      started()
      return new Promise((resolve) => (finish = resolve))
    }
    const server = createServer()

    const first = upload(server, minimalDocx(paragraph('Garden')))
    await running

    const heavy = heavyDocx()
    expect(heavy.length).toBeGreaterThan(256 * 1024)
    expect(heavy.length).toBeLessThan(400 * 1024)
    const busy = await upload(server, heavy)
    expect(busy.status).toBe(503)
    expect(busy.headers.get('Retry-After')).toBe('10')
    expect((await busy.json()).error).toHaveProperty('code', 'IMPORT_BUSY')

    finish(result)
    expect((await first).status).toBe(200)

    importDocxHook = async () => result
    expect((await upload(server, minimalDocx(paragraph('Garden')))).status).toBe(200)
  })

  test('an import that throws still frees the slot', async () => {
    importDocxHook = async () => {
      throw new Error('damaged')
    }
    const server = createServer()
    expect((await upload(server, minimalDocx(paragraph('Garden')))).status).toBe(422)

    importDocxHook = async () => result
    expect((await upload(server, minimalDocx(paragraph('Garden')))).status).toBe(200)
  })
})
