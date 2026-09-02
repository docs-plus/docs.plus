import { describe, expect, test } from 'bun:test'
import type { Logger } from 'pino'

import * as documentChanges from '../../../document-changes'
import * as documentContent from '../../../document-content'
import * as documentConversion from '../../../document-conversion'
import * as documentVersions from '../../../document-versions'
import * as linkMetadata from '../../../link-metadata'
import { buildOpenApiDocument } from '../../domain/document'
import type { OpenApiOperation } from '../../types'

const stub = {} as never
const logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => logger
} as unknown as Logger

/** Hono writes `:documentId`; OpenAPI writes `{documentId}`. */
const toOpenApiPath = (prefix: string, path: string): string =>
  `${prefix}${path}`.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\/$/, '')

const mounted = (): Set<string> => {
  const modules = [
    [
      '/api/documents',
      documentContent.init({
        prisma: stub,
        logger,
        verifyServiceRole: () => true,
        serviceRoleKey: null,
        wsApplyBaseUrl: 'http://x'
      }).router
    ],
    [
      '/api/documents',
      documentVersions.init({
        prisma: stub,
        logger,
        verifyServiceRole: () => true,
        serviceRoleKey: null,
        wsOpsBaseUrl: 'http://x',
        getOwnerProfiles: async () => []
      }).router
    ],
    [
      '/api/documents',
      documentChanges.init({
        prisma: stub,
        logger,
        verifyServiceRole: () => true,
        getOwnerProfiles: async () => []
      }).router
    ],
    [
      '/api/documents',
      documentConversion.init({ prisma: stub, logger, mediaPublicBaseUrl: null }).router
    ],
    ['/api/metadata', linkMetadata.init({ redis: null as never, logger }).router]
  ] as const

  const out = new Set<string>()
  for (const [prefix, router] of modules) {
    for (const route of router.routes) {
      if (route.method === 'ALL') continue
      out.add(`${route.method} ${toOpenApiPath(prefix, route.path)}`)
    }
  }
  return out
}

const spec = buildOpenApiDocument({ servers: [{ url: 'http://localhost:4000' }], version: '0.0.0' })

describe('OpenAPI document', () => {
  test('every mounted module route is published', () => {
    // A route can be mounted without being described, and nothing but a reader
    // would notice. That is how the document-changes route nearly shipped
    // invisible in /docs.
    const published = new Set(
      Object.entries(spec.paths).flatMap(([path, item]) =>
        Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`)
      )
    )
    const missing = [...mounted()].filter((route) => !published.has(route))
    expect(missing).toEqual([])
  })

  test('operation ids are unique, so a generated client cannot collide', () => {
    const ids = Object.values(spec.paths).flatMap((item) =>
      Object.values(item).map((op) => (op as OpenApiOperation).operationId)
    )
    expect(ids.length - new Set(ids).size).toBe(0)
  })

  test('every component reference resolves', () => {
    // A dangling $ref renders as a broken schema in /docs and breaks a generated
    // client, and nothing else in the build would notice.
    const groups = spec.components as unknown as Record<string, Record<string, unknown>>
    const dangling = [...JSON.stringify(spec).matchAll(/"#\/components\/([^/]+)\/([^"]+)"/g)]
      .filter(([, group, name]) => groups[group]?.[name] === undefined)
      .map(([, group, name]) => `${group}/${name}`)
    expect([...new Set(dangling)]).toEqual([])
  })
})
