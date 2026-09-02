import { describe, expect, test } from 'bun:test'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { Hono } from 'hono'
import { requestId } from 'hono/request-id'
import type { Logger } from 'pino'
import * as Y from 'yjs'

import { createMockPrisma, TestServer } from '../../../../../tests/helpers/test-server'
import { migrationExtensions } from '../../../../lib/migration-extensions'
import type { ProfileLite } from '../../../document-versions/types'
import { createComputeDocumentChanges } from '../../domain/computeDocumentChanges'
import { createRouter } from '../../http/router'
import { doc, heading, para, text } from '../fixtures'

const SERVICE_KEY = 'changes-service-role-key'
const AUTH = { Authorization: `Bearer ${SERVICE_KEY}` }
const DOCUMENT_ID = 'abcdefghij123456789'
const T0 = new Date('2026-02-01T10:00:00.000Z')

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const snapshot = (document: ReturnType<typeof doc>): Uint8Array =>
  Y.encodeStateAsUpdate(TiptapTransformer.toYdoc(document, 'default', migrationExtensions))

interface Row {
  id: number
  version: number
  createdAt: Date
  data: Uint8Array
  trigger?: string | null
  triggeredBy?: string | null
  contributors?: string[]
}

const at = (minutes: number): Date => new Date(T0.getTime() + minutes * 60_000)

const harness = (options: { rows?: Row[]; missing?: boolean; profilesThrow?: boolean } = {}) => {
  const rows = options.rows ?? []
  const queries: string[] = []
  const selects: Record<string, unknown>[] = []
  const prisma = createMockPrisma() as any

  prisma.documentMetadata.findUnique = async () => {
    queries.push('meta')
    return options.missing ? null : { deletedAt: null }
  }

  prisma.documents.findFirst = async (args: any) => {
    queries.push('anchor')
    selects.push(args.select)
    const bound = args.where.createdAt.lte as Date
    const [row] = rows
      .filter((r) => r.createdAt <= bound)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.version - a.version)
    return row ? { id: row.id, version: row.version, createdAt: row.createdAt } : null
  }

  prisma.documents.findMany = async (args: any) => {
    selects.push(args.select)
    if (args.where.id) {
      queries.push('bytes')
      return rows
        .filter((r) => (args.where.id.in as number[]).includes(r.id))
        .map((r) => ({ id: r.id, data: r.data }))
    }
    queries.push('window')
    const { gt, lte } = args.where.version
    return rows
      .filter((r) => r.version > gt && r.version <= lte)
      .map((r) => ({
        trigger: r.trigger ?? null,
        triggeredBy: r.triggeredBy ?? null,
        contributors: r.contributors ?? []
      }))
  }

  const app = new Hono()
  app.use('*', requestId())
  app.route(
    '/api/documents',
    createRouter({
      compute: createComputeDocumentChanges({
        prisma,
        logger: silentLogger,
        getOwnerProfiles: async (ids): Promise<ProfileLite[]> => {
          if (options.profilesThrow) throw new Error('profile service down')
          return ids.map((id) => ({
            id,
            avatar_url: null,
            avatar_updated_at: null,
            full_name: null,
            display_name: id,
            status: null
          }))
        }
      }),
      logger: silentLogger,
      verifyServiceRole: (header) => header === `Bearer ${SERVICE_KEY}`
    })
  )

  return { server: new TestServer(app), queries, selects }
}

const url = (query: string, id = DOCUMENT_ID) => `/api/documents/${id}/changes?${query}`
const since = (minutes: number) => `since=${encodeURIComponent(at(minutes).toISOString())}`
const until = (minutes: number) => `until=${encodeURIComponent(at(minutes).toISOString())}`

const ONE = doc(heading(1, 'Title', 't1'), para(text('one two three')))
const TWO = doc(
  heading(1, 'Title', 't1'),
  para(text('one two three')),
  heading(2, 'Added', 'a1'),
  para(text('four five'))
)

describe('GET /api/documents/:documentId/changes', () => {
  test('refuses a request with no service-role bearer', async () => {
    const { server, queries } = harness()
    const response = await server.get(url(since(0)))
    expect(response.status).toBe(401)
    expect(queries).toEqual([])
  })

  test('checks the bearer before the parameters, so it is no validity oracle', async () => {
    const { server } = harness()
    expect((await server.get(url(since(0), 'not-an-id'))).status).toBe(401)
  })

  test('rejects a malformed documentId before any database call', async () => {
    const { server, queries } = harness()
    const response = await server.get(url(since(0), 'not-an-id'), AUTH)
    expect(response.status).toBe(400)
    expect(queries).toEqual([])
  })

  test('rejects a window that ends before it starts', async () => {
    const { server } = harness()
    const response = await server.get(url(`${since(10)}&${until(0)}`), AUTH)
    expect(response.status).toBe(400)
  })

  test('404s a document with no metadata row', async () => {
    const { server } = harness({ missing: true })
    expect((await server.get(url(since(0)), AUTH)).status).toBe(404)
  })

  test('an until before the first row reports no anchors and runs no attribution query', async () => {
    const { server, queries } = harness({
      rows: [{ id: 1, version: 1, createdAt: at(60), data: snapshot(ONE) }]
    })
    const response = await server.get(url(`${since(0)}&${until(10)}`), AUTH)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.baseline).toBeNull()
    expect(body.data.head).toBeNull()
    expect(body.data.changed).toBe(false)
    expect(queries).not.toContain('window')
  })

  test('the same row on both ends reports no change and reads no bytes', async () => {
    const { server, queries } = harness({
      rows: [{ id: 1, version: 1, createdAt: at(5), data: snapshot(ONE) }]
    })
    const body = await (await server.get(url(`${since(10)}&${until(20)}`), AUTH)).json()

    expect(body.data.changed).toBe(false)
    expect(body.data.summary.versions).toBe(0)
    expect(queries).not.toContain('bytes')
  })

  test('two rows holding identical bytes report no change, truthfully, without decoding', async () => {
    // Undecodable bytes on both sides: a decode would 500, so a 200 proves the
    // byte compare answered first. A named checkpoint really does mint this row.
    const same = new Uint8Array([9, 9, 9, 9])
    const { server } = harness({
      rows: [
        { id: 1, version: 1, createdAt: at(0), data: same },
        { id: 2, version: 2, createdAt: at(20), data: same, trigger: 'checkpoint' }
      ]
    })
    const body = await (await server.get(url(`${since(0)}&${until(30)}`), AUTH)).json()

    expect(body.data.changed).toBe(false)
    expect(body.data.summary.versions).toBe(1)
    expect(body.data.summary.triggers).toEqual(['checkpoint'])
  })

  test('reports an added section, and adds the tree only for scope=headings', async () => {
    const rows = [
      { id: 1, version: 1, createdAt: at(0), data: snapshot(ONE) },
      { id: 2, version: 2, createdAt: at(20), data: snapshot(TWO), triggeredBy: 'user-1' }
    ]
    const summary = (
      await (await harness({ rows }).server.get(url(`${since(0)}&${until(30)}`), AUTH)).json()
    ).data
    expect(summary.changed).toBe(true)
    expect(summary.summary.sectionsAdded).toBe(1)
    expect(summary.summary.contributors.map((p: ProfileLite) => p.id)).toEqual(['user-1'])
    expect(summary.sections).toBeUndefined()

    const headings = (
      await (
        await harness({ rows }).server.get(url(`${since(0)}&${until(30)}&scope=headings`), AUTH)
      ).json()
    ).data
    expect(headings.sections).toHaveLength(1)
    expect(headings.sections[0].text).toBe('Title')
    expect(headings.sections[0].children[0]).toMatchObject({ text: 'Added', status: 'added' })
  })

  test('a window carrying only a toc-id rewrite reports no change', async () => {
    // The bytes differ, so a byte-derived `changed` would say true and the digest
    // would mail "0 sections changed". This is the editor's first-open pass.
    const { server } = harness({
      rows: [
        { id: 1, version: 1, createdAt: at(0), data: snapshot(doc(heading(1, 'Title', 'aaa'))) },
        { id: 2, version: 2, createdAt: at(20), data: snapshot(doc(heading(1, 'Title', 'zzz'))) }
      ]
    })
    const body = await (await server.get(url(`${since(0)}&${until(30)}`), AUTH)).json()
    expect(body.data.changed).toBe(false)
    expect(body.data.summary.versions).toBe(1)
  })

  test('a head with no baseline reads the whole document as added', async () => {
    const { server } = harness({
      rows: [{ id: 2, version: 2, createdAt: at(20), data: snapshot(TWO) }]
    })
    const body = await (
      await server.get(url(`${since(0)}&${until(30)}&scope=headings`), AUTH)
    ).json()

    expect(body.data.baseline).toBeNull()
    expect(body.data.changed).toBe(true)
    expect(body.data.summary.sectionsAdded).toBe(2)
    expect(body.data.summary.sectionsRemoved).toBe(0)
  })

  test('500s when a stored snapshot cannot be decoded', async () => {
    const { server } = harness({
      rows: [
        { id: 1, version: 1, createdAt: at(0), data: snapshot(ONE) },
        { id: 2, version: 2, createdAt: at(20), data: new Uint8Array([1, 2, 3]) }
      ]
    })
    expect((await server.get(url(`${since(0)}&${until(30)}`), AUTH)).status).toBe(500)
  })

  test('a profile-lookup outage empties contributors instead of failing', async () => {
    const { server } = harness({
      profilesThrow: true,
      rows: [
        { id: 1, version: 1, createdAt: at(0), data: snapshot(ONE) },
        { id: 2, version: 2, createdAt: at(20), data: snapshot(TWO), triggeredBy: 'user-1' }
      ]
    })
    const body = await (await server.get(url(`${since(0)}&${until(30)}`), AUTH)).json()
    expect(body.data.summary.contributors).toEqual([])
    expect(body.data.changed).toBe(true)
  })

  test('reads snapshot bytes on exactly one query, and never selects data for an anchor', async () => {
    const { server, selects } = harness({
      rows: [
        { id: 1, version: 1, createdAt: at(0), data: snapshot(ONE) },
        { id: 2, version: 2, createdAt: at(20), data: snapshot(TWO) }
      ]
    })
    await server.get(url(`${since(0)}&${until(30)}`), AUTH)
    expect(selects.filter((select) => 'data' in select)).toHaveLength(1)
  })
})
