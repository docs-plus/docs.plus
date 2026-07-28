import { beforeEach, describe, expect, test } from 'bun:test'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import type { Logger } from 'pino'
import * as Y from 'yjs'

import { createMockPrisma, TestServer } from '../../../../../tests/helpers/test-server'
import { migrationExtensions } from '../../../../lib/migration-extensions'
import { createRouter } from '../../http/router'
import type { CheckpointHopRequest, RestoreHopRequest } from '../../infra/wsVersionsClient'
import type { VersionRow } from '../../infra/versionsStore'
import type { ProfileLite, WsCheckpointOutcome, WsRevertOutcome } from '../../types'
import { MAX_VERSION_NAME_CHARS, MAX_VERSION_NUMBER } from '../../types'

const SERVICE_KEY = 'versions-service-role-key'
const AUTH = { Authorization: `Bearer ${SERVICE_KEY}` }
const DOCUMENT_ID = 'abcdefghij123456789'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const snapshotBytes = (content: Record<string, unknown>[]): Buffer =>
  Buffer.from(
    Y.encodeStateAsUpdate(
      TiptapTransformer.toYdoc({ type: 'doc', content }, 'default', migrationExtensions)
    )
  )

const CREATED_AT = new Date('2026-02-01T10:00:00.000Z')

const versionRow = (over: Partial<VersionRow> = {}): VersionRow => ({
  version: 1,
  commitMessage: null,
  trigger: null,
  triggeredBy: null,
  contributors: [],
  createdAt: CREATED_AT,
  ...over
})

const profile = (id: string): ProfileLite => ({
  id,
  avatar_url: null,
  avatar_updated_at: null,
  full_name: `Full ${id}`,
  display_name: `Display ${id}`,
  status: 'online'
})

interface Harness {
  server: TestServer
  prisma: any
  checkpoints: CheckpointHopRequest[]
  restores: RestoreHopRequest[]
  setCheckpoint: (outcome: WsCheckpointOutcome) => void
  setRestore: (outcome: WsRevertOutcome) => void
  profileLookups: string[][]
  queries: string[]
  listArgs: any[]
}

const harness = (
  options: { serviceRoleEnabled?: boolean; profilesThrow?: boolean } = {}
): Harness => {
  const prisma = createMockPrisma() as any
  const checkpoints: CheckpointHopRequest[] = []
  const restores: RestoreHopRequest[] = []
  const profileLookups: string[][] = []
  const queries: string[] = []
  const listArgs: any[] = []
  let checkpointOutcome: WsCheckpointOutcome = { status: 'checkpointed' }
  let restoreOutcome: WsRevertOutcome = {
    status: 'reverted',
    restoredFrom: 3,
    backupVersion: 8
  }

  const trace =
    <T>(name: string, impl: (args: any) => Promise<T>) =>
    (args: any): Promise<T> => {
      queries.push(name)
      return impl(args)
    }

  prisma.documentMetadata.findUnique = trace('meta', async () => liveMeta)
  prisma.documents.findMany = trace('list', async (args: any) => {
    listArgs.push(args)
    return []
  })
  prisma.documents.count = trace('count', async () => 0)
  prisma.documents.findFirst = trace('row', async () => null)
  prisma.documents.deleteMany = trace('delete', async () => ({ count: 1 }))
  prisma.documentClientAuthor = { findMany: trace('bindings', async () => []) }
  prisma.$queryRaw = async () => []

  const app = new Hono()
  app.use('*', requestId())
  app.route(
    '/api/documents',
    createRouter({
      prisma,
      logger: silentLogger,
      verifyServiceRole: (header) =>
        options.serviceRoleEnabled === false ? false : header === `Bearer ${SERVICE_KEY}`,
      getOwnerProfiles: async (userIds) => {
        profileLookups.push(userIds)
        if (options.profilesThrow) throw new Error('profile service down')
        return userIds.map(profile)
      },
      wsVersions: {
        checkpoint: async (request) => {
          checkpoints.push(request)
          return checkpointOutcome
        },
        restore: async (request) => {
          restores.push(request)
          return restoreOutcome
        }
      }
    })
  )

  return {
    server: new TestServer(app),
    prisma,
    checkpoints,
    restores,
    profileLookups,
    queries,
    listArgs,
    setCheckpoint: (next) => {
      checkpointOutcome = next
    },
    setRestore: (next) => {
      restoreOutcome = next
    }
  }
}

const liveMeta = {
  documentId: DOCUMENT_ID,
  slug: 'versioned-doc',
  ownerId: 'owner-1',
  email: 'owner@example.com',
  deletedAt: null
}

const listPath = `/api/documents/${DOCUMENT_ID}/versions`
const versionPath = `/api/documents/${DOCUMENT_ID}/versions/4`
const diffPath = `/api/documents/${DOCUMENT_ID}/versions/4/diff`
const restorePath = `/api/documents/${DOCUMENT_ID}/versions/4/restore`

interface RouteCase {
  name: string
  call: (h: Harness, headers?: Record<string, string>) => Promise<{ status: number }>
}

const routes: RouteCase[] = [
  { name: 'GET list', call: (h, headers) => h.server.get(listPath, headers) },
  {
    name: 'POST checkpoint',
    call: (h, headers) => h.server.post(listPath, { name: 'x' }, headers)
  },
  { name: 'GET version', call: (h, headers) => h.server.get(versionPath, headers) },
  { name: 'GET diff', call: (h, headers) => h.server.get(diffPath, headers) },
  { name: 'DELETE version', call: (h, headers) => h.server.delete(versionPath, headers) },
  { name: 'POST restore', call: (h, headers) => h.server.post(restorePath, {}, headers) }
]

describe('Version routes — authorization', () => {
  for (const route of routes) {
    test(`${route.name} rejects a missing bearer and touches nothing`, async () => {
      const h = harness()
      const response = await route.call(h)

      expect(response.status).toBe(401)
      expect(h.queries).toHaveLength(0)
      expect(h.checkpoints).toHaveLength(0)
      expect(h.restores).toHaveLength(0)
    })

    test(`${route.name} rejects a wrong bearer`, async () => {
      const h = harness()
      const response = await route.call(h, { Authorization: 'Bearer nope' })

      expect(response.status).toBe(401)
      expect(h.queries).toHaveLength(0)
    })

    test(`${route.name} rejects a bare user JWT`, async () => {
      const h = harness()
      const response = await route.call(h, {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.user.jwt'
      })

      expect(response.status).toBe(401)
      expect(h.queries).toHaveLength(0)
    })

    test(`${route.name} fails closed when the service-role key is unset`, async () => {
      const h = harness({ serviceRoleEnabled: false })
      const response = await route.call(h, AUTH)

      expect(response.status).toBe(401)
      expect(h.queries).toHaveLength(0)
    })
  }

  test('the 401 carries the canonical envelope', async () => {
    const h = harness()
    const response = await h.server.get(listPath)
    const body = await response.json()

    expect(body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } })
  })
})

describe('Version routes — 400 matrix', () => {
  let h: Harness

  beforeEach(() => {
    h = harness()
  })

  const badRequest = async (response: { status: number; json: () => Promise<any> }) => {
    expect(response.status).toBe(400)
    expect((await response.json()).error).toHaveProperty('code', 'VALIDATION_ERROR')
    expect(h.queries).toHaveLength(0)
  }

  test('rejects a non-19-char documentId before any query', async () => {
    await badRequest(await h.server.get('/api/documents/short/versions', AUTH))
  })

  test('rejects a traversal-shaped documentId before any query', async () => {
    await badRequest(await h.server.get('/api/documents/%2E%2E%2Fmetrics/versions', AUTH))
  })

  test('rejects a non-numeric version', async () => {
    await badRequest(await h.server.get(`/api/documents/${DOCUMENT_ID}/versions/abc`, AUTH))
  })

  test('rejects version zero', async () => {
    await badRequest(await h.server.get(`/api/documents/${DOCUMENT_ID}/versions/0`, AUTH))
  })

  test('rejects a version past the int4 ceiling', async () => {
    await badRequest(
      await h.server.get(`/api/documents/${DOCUMENT_ID}/versions/${MAX_VERSION_NUMBER + 1}`, AUTH)
    )
  })

  test('rejects an out-of-range version on restore', async () => {
    await badRequest(
      await h.server.post(
        `/api/documents/${DOCUMENT_ID}/versions/${MAX_VERSION_NUMBER + 1}/restore`,
        {},
        AUTH
      )
    )
    expect(h.restores).toHaveLength(0)
  })

  test('rejects a page size over the cap', async () => {
    await badRequest(await h.server.get(`${listPath}?limit=101`, AUTH))
  })

  test('rejects a negative offset', async () => {
    await badRequest(await h.server.get(`${listPath}?offset=-1`, AUTH))
  })

  test('rejects a blank checkpoint name without hopping', async () => {
    await badRequest(await h.server.post(listPath, { name: '   ' }, AUTH))
    expect(h.checkpoints).toHaveLength(0)
  })

  test('rejects a checkpoint name over the character cap', async () => {
    await badRequest(
      await h.server.post(listPath, { name: 'x'.repeat(MAX_VERSION_NAME_CHARS + 1) }, AUTH)
    )
    expect(h.checkpoints).toHaveLength(0)
  })

  test('rejects an unsupported read format', async () => {
    await badRequest(await h.server.get(`${versionPath}?format=yjs`, AUTH))
  })

  test('rejects a non-numeric base', async () => {
    await badRequest(await h.server.get(`${diffPath}?base=abc`, AUTH))
  })

  test('rejects base zero', async () => {
    await badRequest(await h.server.get(`${diffPath}?base=0`, AUTH))
  })
})

describe('Version routes — 404 matrix', () => {
  for (const route of routes) {
    test(`${route.name} 404s an unknown document`, async () => {
      const h = harness()
      h.prisma.documentMetadata.findUnique = async () => null

      const response = await route.call(h, AUTH)
      expect(response.status).toBe(404)
      expect(h.checkpoints).toHaveLength(0)
      expect(h.restores).toHaveLength(0)
    })

    test(`${route.name} 404s a tombstoned document`, async () => {
      const h = harness()
      h.prisma.documentMetadata.findUnique = async () => ({ ...liveMeta, deletedAt: new Date() })

      const response = await route.call(h, AUTH)
      expect(response.status).toBe(404)
      expect(h.checkpoints).toHaveLength(0)
      expect(h.restores).toHaveLength(0)
    })
  }

  test('GET 404s a version the document does not have', async () => {
    const h = harness()
    const response = await h.server.get(versionPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.message).toBe('Version not found')
  })

  test('DELETE 404s a version the document does not have', async () => {
    const h = harness()
    h.prisma.$queryRaw = async () => []
    h.prisma.documents.findFirst = async () => null

    const response = await h.server.delete(versionPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.message).toBe('Version not found')
  })
})

describe('DELETE /api/documents/:documentId/versions/:version', () => {
  test('409s the head version and deletes nothing', async () => {
    const h = harness()
    // The guarded DELETE matches no row when the target is the head; the row
    // still exists, which is what separates 409 from 404.
    let deletes = 0
    h.prisma.$queryRaw = async () => {
      deletes += 1
      return []
    }
    h.prisma.documents.findFirst = async () => ({ version: 4 })

    const response = await h.server.delete(versionPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toHaveProperty('code', 'CONFLICT')
    // One guarded statement ran and removed nothing.
    expect(deletes).toBe(1)
  })

  test('deletes a non-head version', async () => {
    const h = harness()
    h.prisma.$queryRaw = async () => [{ version: 4 }]

    const response = await h.server.delete(versionPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ documentId: DOCUMENT_ID, version: 4, deleted: true })
  })
})

describe('GET /api/documents/:documentId/versions', () => {
  let h: Harness

  beforeEach(() => {
    h = harness()
  })

  test('defaults to the first page and echoes the window back', async () => {
    h.prisma.documents.findMany = async (args: any) => {
      h.listArgs.push(args)
      return [versionRow({ version: 2 }), versionRow({ version: 1 })]
    }
    h.prisma.documents.count = async () => 2

    const response = await h.server.get(listPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(h.listArgs[0]).toMatchObject({ skip: 0, take: 50, orderBy: { version: 'desc' } })
    expect(body.data).toMatchObject({ documentId: DOCUMENT_ID, total: 2, limit: 50, offset: 0 })
    expect(body.data.versions.map((v: any) => v.version)).toEqual([2, 1])
  })

  test('passes an explicit page window to the query and reports the full total', async () => {
    h.prisma.documents.findMany = async (args: any) => {
      h.listArgs.push(args)
      return [versionRow({ version: 7 })]
    }
    h.prisma.documents.count = async () => 31

    const response = await h.server.get(`${listPath}?limit=2&offset=4`, AUTH)
    const body = await response.json()

    expect(h.listArgs[0]).toMatchObject({ skip: 4, take: 2 })
    expect(body.data).toMatchObject({ total: 31, limit: 2, offset: 4 })
    expect(body.data.versions).toHaveLength(1)
  })

  test('renders legacy rows with no attribution cleanly', async () => {
    h.prisma.documents.findMany = async () => [versionRow({ version: 5, commitMessage: '' })]
    h.prisma.documents.count = async () => 1

    const response = await h.server.get(listPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.versions[0]).toEqual({
      version: 5,
      name: null,
      trigger: null,
      triggeredBy: null,
      contributors: [],
      createdAt: CREATED_AT.toISOString()
    })
    expect(h.profileLookups).toHaveLength(0)
  })

  test('resolves every referenced profile in one batch lookup', async () => {
    h.prisma.documents.findMany = async () => [
      versionRow({ version: 3, triggeredBy: 'u1', contributors: ['u2', 'u3'] }),
      versionRow({ version: 2, triggeredBy: 'u2', contributors: ['u1'] }),
      versionRow({ version: 1, triggeredBy: null, contributors: [] })
    ]
    h.prisma.documents.count = async () => 3

    const response = await h.server.get(listPath, AUTH)
    const body = await response.json()

    expect(h.profileLookups).toHaveLength(1)
    expect([...h.profileLookups[0]].sort()).toEqual(['u1', 'u2', 'u3'])
    expect(body.data.versions[0].triggeredBy).toMatchObject({
      id: 'u1',
      display_name: 'Display u1'
    })
    expect(body.data.versions[0].contributors.map((p: any) => p.id)).toEqual(['u2', 'u3'])
    expect(body.data.versions[2].contributors).toEqual([])
  })

  test('degrades to bare rows when the profile lookup throws', async () => {
    const failing = harness({ profilesThrow: true })
    failing.prisma.documents.findMany = async () => [versionRow({ version: 1, triggeredBy: 'u1' })]
    failing.prisma.documents.count = async () => 1

    const response = await failing.server.get(listPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.versions[0].triggeredBy).toBeNull()
  })
})

describe('GET /api/documents/:documentId/versions/:version', () => {
  let h: Harness

  beforeEach(() => {
    h = harness()
  })

  test('returns the stored snapshot as Tiptap JSON', async () => {
    h.prisma.documents.findFirst = async () => ({
      version: 4,
      data: snapshotBytes([
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'body' }] }
      ])
    })

    const response = await h.server.get(versionPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ documentId: DOCUMENT_ID, version: 4, format: 'json' })
    expect(body.data.content.content.map((n: any) => n.type)).toEqual(['heading', 'paragraph'])
  })

  test('returns block text in document order', async () => {
    h.prisma.documents.findFirst = async () => ({
      version: 4,
      data: snapshotBytes([
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'body' }] }
      ])
    })

    const response = await h.server.get(`${versionPath}?format=text`, AUTH)
    const body = await response.json()

    expect(body.data.format).toBe('text')
    expect(body.data.content).toBe('Title\nbody')
  })

  test('500s on undecodable snapshot bytes', async () => {
    h.prisma.documents.findFirst = async () => ({ version: 4, data: Buffer.from([9, 9, 9, 9]) })

    const response = await h.server.get(versionPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toHaveProperty('code', 'INTERNAL_SERVER_ERROR')
  })
})

describe('GET /api/documents/:documentId/versions/:version/diff', () => {
  const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

  // Dispatches on the two shapes `findDiffRows` issues: an exact version, and
  // "greatest below" for the default base. A `version - 1` store fails here.
  const withRows = (h: Harness, rows: Record<number, Buffer>): void => {
    h.prisma.documents.findFirst = async (args: any) => {
      const { version } = args.where
      if (typeof version === 'number') {
        return rows[version] ? { version, data: rows[version] } : null
      }
      const below = Object.keys(rows)
        .map(Number)
        .filter((candidate) => candidate < version.lt)
        .sort((a, b) => b - a)[0]
      return below === undefined ? null : { version: below, data: rows[below] }
    }
  }

  const bindEvery = (h: Harness, userId: string, isAnonymous: boolean): void => {
    h.prisma.documentClientAuthor.findMany = async (args: any) =>
      args.where.clientId.in.map((clientId: bigint) => ({ clientId, userId, isAnonymous }))
  }

  const clientIdsOf = (body: any): number[] =>
    body.data.changes.flatMap((change: any) => change.clientIds)

  test('an omitted base resolves to the greatest version below, not version - 1', async () => {
    const h = harness()
    withRows(h, {
      1: snapshotBytes([para('one')]),
      2: snapshotBytes([para('two')]),
      4: snapshotBytes([para('four')])
    })

    const response = await h.server.get(diffPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ documentId: DOCUMENT_ID, fromVersion: 2, toVersion: 4 })
    // Reads run straight off Postgres — nothing on this route can 503.
    expect(h.checkpoints).toHaveLength(0)
    expect(h.restores).toHaveLength(0)
  })

  test('an explicit base is used verbatim', async () => {
    const h = harness()
    withRows(h, {
      1: snapshotBytes([para('one')]),
      2: snapshotBytes([para('two')]),
      4: snapshotBytes([para('four')])
    })

    const body = await (await h.server.get(`${diffPath}?base=1`, AUTH)).json()

    expect(body.data).toMatchObject({ fromVersion: 1, toVersion: 4 })
  })

  test('400s a base at or above the version and touches nothing', async () => {
    const h = harness()

    for (const base of [4, 5]) {
      const response = await h.server.get(`${diffPath}?base=${base}`, AUTH)
      expect(response.status).toBe(400)
      expect((await response.json()).error).toHaveProperty('code', 'VALIDATION_ERROR')
    }
    expect(h.queries).toHaveLength(0)
  })

  test('404s a version the document does not have', async () => {
    const h = harness()
    withRows(h, { 1: snapshotBytes([para('one')]) })

    const response = await h.server.get(diffPath, AUTH)

    expect(response.status).toBe(404)
    expect((await response.json()).error.message).toBe('Version not found')
  })

  test('404s an explicit base the document does not have', async () => {
    const h = harness()
    withRows(h, { 2: snapshotBytes([para('two')]), 4: snapshotBytes([para('four')]) })

    const response = await h.server.get(`${diffPath}?base=3`, AUTH)

    expect(response.status).toBe(404)
    expect((await response.json()).error.message).toBe('Base version not found')
  })

  test('reads a first version as a whole document added', async () => {
    const h = harness()
    withRows(h, { 1: snapshotBytes([para('one'), para('two')]) })

    const response = await h.server.get(`${listPath}/1/diff`, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ fromVersion: 0, toVersion: 1, blocksBefore: 0 })
    expect(body.data.changes.map((change: any) => change.kind)).toEqual(['added', 'added'])
  })

  test('answers a byte-identical pair with zeroed counts and no attribution lookup', async () => {
    const h = harness()
    const same = snapshotBytes([para('unchanged')])
    withRows(h, { 3: same, 4: same })

    const response = await h.server.get(diffPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({
      documentId: DOCUMENT_ID,
      fromVersion: 3,
      toVersion: 4,
      blocksBefore: 0,
      blocksAfter: 0,
      changes: [],
      totalChanges: 0,
      coarse: false,
      unattributed: false,
      authors: []
    })
    expect(h.queries).not.toContain('bindings')
  })

  test('500s on undecodable snapshot bytes', async () => {
    const h = harness()
    withRows(h, { 3: Buffer.from([9, 9, 9, 9]), 4: snapshotBytes([para('four')]) })

    const response = await h.server.get(diffPath, AUTH)

    expect(response.status).toBe(500)
    expect((await response.json()).error).toHaveProperty('code', 'INTERNAL_SERVER_ERROR')
  })

  test('reports block clientIds even when no binding names them', async () => {
    const h = harness()
    withRows(h, { 3: snapshotBytes([para('before')]), 4: snapshotBytes([para('after')]) })

    const body = await (await h.server.get(diffPath, AUTH)).json()

    expect(body.data.unattributed).toBe(false)
    expect(body.data.authors).toEqual([])
    expect(clientIdsOf(body).length).toBeGreaterThan(0)
  })

  test('names an anonymous author and keeps the clientId a JSON number', async () => {
    const h = harness()
    withRows(h, { 3: snapshotBytes([para('before')]), 4: snapshotBytes([para('after')]) })
    bindEvery(h, 'author-1', true)

    const response = await h.server.get(diffPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.authors).toHaveLength(1)
    expect(body.data.authors[0]).toMatchObject({
      anonymous: true,
      user: { id: 'author-1', display_name: 'Display author-1' }
    })
    expect(typeof body.data.authors[0].clientId).toBe('number')
    expect(clientIdsOf(body)).toContain(body.data.authors[0].clientId)
  })

  test('keeps a bound author with no profile rather than dropping the entry', async () => {
    const h = harness({ profilesThrow: true })
    withRows(h, { 3: snapshotBytes([para('before')]), 4: snapshotBytes([para('after')]) })
    bindEvery(h, 'author-1', false)

    const body = await (await h.server.get(diffPath, AUTH)).json()

    expect(body.data.authors[0]).toMatchObject({ user: null, anonymous: false })
  })

  test('drops names but not clientIds when the binding lookup throws', async () => {
    const h = harness()
    withRows(h, { 3: snapshotBytes([para('before')]), 4: snapshotBytes([para('after')]) })
    h.prisma.documentClientAuthor.findMany = async () => {
      throw new Error('binding table unavailable')
    }

    const response = await h.server.get(diffPath, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.authors).toEqual([])
    expect(clientIdsOf(body).length).toBeGreaterThan(0)
  })
})

describe('POST /api/documents/:documentId/versions', () => {
  let h: Harness

  beforeEach(() => {
    h = harness()
  })

  test('forwards the trimmed name over the hop and echoes it back', async () => {
    const response = await h.server.post(listPath, { name: '  Release cut  ' }, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ documentId: DOCUMENT_ID, name: 'Release cut' })
    expect(h.checkpoints).toHaveLength(1)
    expect(h.checkpoints[0]).toMatchObject({ documentId: DOCUMENT_ID, name: 'Release cut' })
  })

  test('maps a draft refusal to 422 with the draft code', async () => {
    h.setCheckpoint({ status: 'draft-document' })

    const response = await h.server.post(listPath, { name: 'nope' }, AUTH)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toHaveProperty('code', 'DRAFT_DOCUMENT')
  })

  test('maps a persist failure to a 500 that warns about live visibility', async () => {
    h.setCheckpoint({ status: 'persist-failed' })

    const response = await h.server.post(listPath, { name: 'nope' }, AUTH)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.message).toContain('wedged')
  })

  test('maps an unreachable collaboration process to 503', async () => {
    h.setCheckpoint({ status: 'unreachable' })

    const response = await h.server.post(listPath, { name: 'nope' }, AUTH)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toHaveProperty('code', 'SERVICE_UNAVAILABLE')
  })

  test('maps a rejected internal bearer to a 500 naming the key mismatch', async () => {
    h.setCheckpoint({ status: 'upstream-unauthorized' })

    const response = await h.server.post(listPath, { name: 'nope' }, AUTH)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.message).toContain('service-role keys')
  })
})

describe('POST /api/documents/:documentId/versions/:version/restore', () => {
  let h: Harness

  beforeEach(() => {
    h = harness()
  })

  test('returns the restored and backup version numbers', async () => {
    const response = await h.server.post(restorePath, {}, AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ documentId: DOCUMENT_ID, restoredFrom: 3, backupVersion: 8 })
    expect(h.restores[0]).toMatchObject({ documentId: DOCUMENT_ID, version: 4 })
  })

  test('surfaces an unreadable snapshot as 422 with the upstream detail', async () => {
    h.setRestore({ status: 'invalid-content', detail: 'stored version could not be decoded' })

    const response = await h.server.post(restorePath, {}, AUTH)
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'stored version could not be decoded'
    })
  })

  test('maps a failed pre-restore backup to a 500 that says nothing was restored', async () => {
    h.setRestore({ status: 'backup-failed' })

    const response = await h.server.post(restorePath, {}, AUTH)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.message).toContain('The document is unchanged')
  })
})
