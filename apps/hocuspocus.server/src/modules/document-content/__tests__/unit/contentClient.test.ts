import { describe, expect, test } from 'bun:test'
import type { Logger } from 'pino'

import { createMockPrisma } from '../../../../../tests/helpers/test-server'
import type { PrismaClient } from '../../../../generated/prisma/client'
import { createContentClient, isPreConnectError } from '../../infra/contentClient'
import { REQUIRE_LOADED_HEADER, ROOM_NOT_LOADED_CODE } from '../../types'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger
} as unknown as Logger

const titleDoc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] }]
})

describe('contentClient.apply — 413 mapping', () => {
  test('maps JSON and non-JSON 413 responses to invalid-content instead of unreachable', async () => {
    let bodyText = JSON.stringify({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Content exceeds the 5242880-byte limit' }
    })
    let contentType = 'application/json'

    const server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(bodyText, {
          status: 413,
          headers: { 'Content-Type': contentType }
        })
    })

    try {
      const client = createContentClient({
        baseUrl: `http://127.0.0.1:${server.port}`,
        serviceRoleKey: 'test-service-key',
        prisma: createMockPrisma() as unknown as PrismaClient,
        logger: silentLogger
      })

      const jsonResult = await client.apply({
        documentId: 'doc-1',
        mode: 'replace',
        content: { type: 'doc', content: [] }
      })
      expect(jsonResult).toEqual({
        status: 'invalid-content',
        detail: 'Content exceeds the 5242880-byte limit'
      })

      bodyText = 'Request Entity Too Large'
      contentType = 'text/plain'
      const plainResult = await client.apply({
        documentId: 'doc-1',
        mode: 'replace',
        content: { type: 'doc', content: [] }
      })
      expect(plainResult).toEqual({
        status: 'invalid-content',
        detail: 'content exceeds the size limit'
      })
    } finally {
      server.stop(true)
    }
  })

  test('does not follow 3xx redirects so the service-role bearer never leaves the peer origin', async () => {
    let externalHits = 0
    const external = Bun.serve({
      port: 0,
      fetch: () => {
        externalHits += 1
        return Response.json({ success: true, data: { version: 99 } })
      }
    })
    const redirector = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(null, {
          status: 307,
          headers: { Location: `http://127.0.0.1:${external.port}/steal` }
        })
    })

    try {
      const client = createContentClient({
        baseUrl: `http://127.0.0.1:${redirector.port}`,
        serviceRoleKey: 'secret-bearer',
        prisma: createMockPrisma() as unknown as PrismaClient,
        logger: silentLogger
      })

      const outcome = await client.apply({
        documentId: 'doc-1',
        mode: 'replace',
        content: titleDoc('No redirect')
      })
      expect(outcome).toEqual({ status: 'unreachable' })
      expect(externalHits).toBe(0)
    } finally {
      redirector.stop(true)
      external.stop(true)
    }
  })
})

describe('contentClient — multi-replica room-owner routing (#816)', () => {
  test('read() routes straight to registered owner A and never hits sticky fallback B', async () => {
    let hitsA = 0
    let hitsB = 0
    const liveContent = titleDoc('Unsaved live edit on A')

    const replicaA = Bun.serve({
      port: 0,
      fetch: () => {
        hitsA += 1
        return Response.json({ success: true, data: { content: liveContent } })
      }
    })
    const replicaB = Bun.serve({
      port: 0,
      fetch: () => {
        hitsB += 1
        return Response.json({ success: true, data: { content: null } })
      }
    })

    try {
      const client = createContentClient({
        baseUrl: `http://127.0.0.1:${replicaB.port}`,
        serviceRoleKey: 'test-key',
        prisma: createMockPrisma() as unknown as PrismaClient,
        logger: silentLogger,
        roomRegistry: {
          lookupOwners: async () => [`http://127.0.0.1:${replicaA.port}`],
          removeOwner: async () => {}
        }
      })

      const outcome = await client.read('doc-live-1')
      expect(outcome).toEqual({ status: 'ok', content: liveContent })
      expect(hitsA).toBe(1)
      expect(hitsB).toBe(0)
    } finally {
      replicaA.stop(true)
      replicaB.stop(true)
    }
  })

  test('read() cleans stale not-loaded and unreachable owners and fails over to the real owner', async () => {
    const removed: Array<[string, string]> = []
    const liveContent = titleDoc('Live on C')

    // Grab an unused closed port to simulate a crashed replica.
    const deadServer = Bun.serve({ port: 0, fetch: () => new Response('bye') })
    const deadUrl = `http://127.0.0.1:${deadServer.port}`
    deadServer.stop(true)

    const stalePeer = Bun.serve({
      port: 0,
      fetch: () => Response.json({ success: true, data: { content: null } })
    })
    const livePeer = Bun.serve({
      port: 0,
      fetch: () => Response.json({ success: true, data: { content: liveContent } })
    })

    try {
      const staleUrl = `http://127.0.0.1:${stalePeer.port}`
      const liveUrl = `http://127.0.0.1:${livePeer.port}`

      const client = createContentClient({
        baseUrl: staleUrl,
        serviceRoleKey: 'test-key',
        prisma: createMockPrisma() as unknown as PrismaClient,
        logger: silentLogger,
        roomRegistry: {
          lookupOwners: async () => [deadUrl, staleUrl, liveUrl],
          removeOwner: async (docId, peer) => {
            removed.push([docId, peer])
          }
        }
      })

      const outcome = await client.read('doc-failover')
      expect(outcome).toEqual({ status: 'ok', content: liveContent })
      expect(removed).toEqual([
        ['doc-failover', deadUrl],
        ['doc-failover', staleUrl]
      ])
    } finally {
      stalePeer.stop(true)
      livePeer.stop(true)
    }
  })

  test('apply() sends x-require-loaded to registered peers, cleans 412/ECONNREFUSED, and falls back cold', async () => {
    const removed: Array<[string, string]> = []
    const seenHeaders: Array<{ target: string; requireLoaded: string | null }> = []

    const deadServer = Bun.serve({ port: 0, fetch: () => new Response('bye') })
    const deadUrl = `http://127.0.0.1:${deadServer.port}`
    deadServer.stop(true)

    const stalePeer = Bun.serve({
      port: 0,
      fetch: (req) => {
        seenHeaders.push({ target: 'stale', requireLoaded: req.headers.get(REQUIRE_LOADED_HEADER) })
        return Response.json(
          { success: false, error: { code: ROOM_NOT_LOADED_CODE, message: 'not loaded' } },
          { status: 412 }
        )
      }
    })
    const fallbackPeer = Bun.serve({
      port: 0,
      fetch: (req) => {
        seenHeaders.push({
          target: 'fallback',
          requireLoaded: req.headers.get(REQUIRE_LOADED_HEADER)
        })
        return Response.json({ success: true, data: { version: 7, rev: 'rev-7' } })
      }
    })

    try {
      const staleUrl = `http://127.0.0.1:${stalePeer.port}`
      const fallbackUrl = `http://127.0.0.1:${fallbackPeer.port}`

      const client = createContentClient({
        baseUrl: fallbackUrl,
        serviceRoleKey: 'test-key',
        prisma: createMockPrisma() as unknown as PrismaClient,
        logger: silentLogger,
        roomRegistry: {
          lookupOwners: async () => [deadUrl, staleUrl],
          removeOwner: async (docId, peer) => {
            removed.push([docId, peer])
          }
        }
      })

      const outcome = await client.apply({
        documentId: 'doc-cold-fallback',
        mode: 'replace',
        content: titleDoc('Applied cold')
      })

      expect(outcome).toEqual({ status: 'applied', version: 7, rev: 'rev-7' })
      expect(removed).toEqual([
        ['doc-cold-fallback', deadUrl],
        ['doc-cold-fallback', staleUrl]
      ])
      expect(seenHeaders).toEqual([
        { target: 'stale', requireLoaded: '1' },
        { target: 'fallback', requireLoaded: null }
      ])
    } finally {
      stalePeer.stop(true)
      fallbackPeer.stop(true)
    }
  })

  test('apply() never retries a non-pre-connect failure (500 or 409) onto another peer', async () => {
    let fallbackHits = 0
    const owner = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json(
          { success: false, error: { code: 'CONFLICT', message: 'rev mismatch' } },
          { status: 409 }
        )
    })
    const fallback = Bun.serve({
      port: 0,
      fetch: () => {
        fallbackHits += 1
        return Response.json({ success: true, data: { version: 2 } })
      }
    })

    try {
      const client = createContentClient({
        baseUrl: `http://127.0.0.1:${fallback.port}`,
        serviceRoleKey: 'test-key',
        prisma: createMockPrisma() as unknown as PrismaClient,
        logger: silentLogger,
        roomRegistry: {
          lookupOwners: async () => [`http://127.0.0.1:${owner.port}`],
          removeOwner: async () => {}
        }
      })

      const outcome = await client.apply({
        documentId: 'doc-conflict',
        mode: 'append',
        content: titleDoc('Do not double-apply')
      })
      expect(outcome).toEqual({ status: 'conflict', detail: 'rev mismatch' })
      expect(fallbackHits).toBe(0)
    } finally {
      owner.stop(true)
      fallback.stop(true)
    }
  })

  test('read() does not evict owner on transient 500 and preserves unavailable over subsequent not-loaded', async () => {
    const removed: Array<[string, string]> = []
    const transientPeer = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json(
          { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'boom' } },
          { status: 500 }
        )
    })
    const coldPeer = Bun.serve({
      port: 0,
      fetch: () => Response.json({ success: true, data: { content: null } })
    })

    try {
      const transientUrl = `http://127.0.0.1:${transientPeer.port}`
      const coldUrl = `http://127.0.0.1:${coldPeer.port}`
      const client = createContentClient({
        baseUrl: coldUrl,
        serviceRoleKey: 'test-key',
        prisma: createMockPrisma() as unknown as PrismaClient,
        logger: silentLogger,
        roomRegistry: {
          lookupOwners: async () => [transientUrl, coldUrl],
          removeOwner: async (docId, peer) => {
            removed.push([docId, peer])
          }
        }
      })

      const outcome = await client.read('doc-transient-err')
      expect(outcome).toEqual({ status: 'unavailable' })
      expect(removed).toEqual([['doc-transient-err', coldUrl]])
    } finally {
      transientPeer.stop(true)
      coldPeer.stop(true)
    }
  })

  test('isPreConnectError accepts only unambiguous pre-connect errors and rejects TimeoutError/ECONNRESET', () => {
    expect(isPreConnectError(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }))).toBe(
      true
    )
    expect(
      isPreConnectError(Object.assign(new Error('refused'), { code: 'ConnectionRefused' }))
    ).toBe(true)
    expect(isPreConnectError(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))).toBe(false)
    expect(isPreConnectError(new DOMException('timed out', 'TimeoutError'))).toBe(false)
  })
})
