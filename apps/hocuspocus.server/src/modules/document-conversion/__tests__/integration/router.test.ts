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

const DOCUMENT_ID = 'abcdefghij123456789'
const NON_OWNER = { Authorization: 'Bearer other-user-token' }

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
