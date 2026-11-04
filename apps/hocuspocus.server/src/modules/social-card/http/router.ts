import { type Context, Hono, type MiddlewareHandler } from 'hono'
import type { Logger } from 'pino'

import type { PrismaClient } from '../../../generated/prisma/client'
import {
  type SocialCardOutcome,
  socialCardRenderSeconds,
  socialCardRequestsTotal
} from '../../../lib/metrics'
import { documentIdField } from '../../../schemas/document.schema'
import { type CardKind, parseCardQuery } from '../domain/cardRequest'
import { CARD_ROW_SELECT, type CardSourceRow } from '../domain/resolveCard'
import { resolveStoredCard } from '../infra/cardReads'
import { createHovercardChatRead, type HovercardChatRead } from '../infra/hovercardReads'
import { renderPng } from '../infra/renderer'
import { createPngCache, createRenderSlot, createSingleFlight, SHED } from '../infra/renderGuards'
import { createHovercardHandler, HOVERCARD_ROUTE } from './hovercard'

export const SOCIAL_CARD_MOUNT_PATH = '/api/documents'
const CARD_ROUTE = '/:documentId/card.png'
const CARD_PATH = new RegExp(`^${SOCIAL_CARD_MOUNT_PATH}/[^/]+/card\\.png$`)

/** The rate limiter gives the card route its own bucket, so crawlers never spend a reader's budget. */
export const isSocialCardPath = (path: string): boolean => CARD_PATH.test(path)

export interface RouterDeps {
  prisma: PrismaClient
  logger: Logger
  kinds: ReadonlySet<CardKind>
  /** Where a shed or failed render sends the crawler. */
  fallbackImageUrl: string
  /** optionalUser with the #596 Auth deadline, as on the slug read. A test hands its own. */
  optionalPadReader: MiddlewareHandler
  /** The hovercard's service-role chat read. A test hands its own. */
  hovercardChat?: HovercardChatRead
}

const etagMatches = (header: string | undefined, etag: string): boolean =>
  !!header &&
  header.split(',').some((tag) => {
    const t = tag.trim()
    return t === '*' || t.replace(/^W\//, '') === etag
  })

export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()
  const cache = createPngCache(8 * 1024 * 1024)
  const slot = createRenderSlot(4)
  const readRow = createSingleFlight<CardSourceRow | null>()
  const render = createSingleFlight<Uint8Array<ArrayBuffer> | typeof SHED>()

  // One body and one header set for every refusal, so the route never tells Private from missing.
  const refuse = (c: Context) => {
    socialCardRequestsTotal.inc({ outcome: 'refused' })
    return c.body('Not found', 404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'X-Robots-Tag': 'noindex'
    })
  }
  const toStaticImage = (
    c: Context,
    outcome: Extract<
      SocialCardOutcome,
      'fallback' | 'chat-shed' | 'chat-unavailable' | 'slot-shed' | 'error'
    >
  ) => {
    socialCardRequestsTotal.inc({ outcome })
    return c.body(null, 302, {
      Location: deps.fallbackImageUrl,
      'Cache-Control': 'public, max-age=300'
    })
  }

  router.get(CARD_ROUTE, async (c) => {
    const documentId = c.req.param('documentId')
    if (!documentIdField.safeParse(documentId).success) return refuse(c)

    try {
      const row = await readRow(documentId, () =>
        deps.prisma.documentMetadata.findUnique({ where: { documentId }, select: CARD_ROW_SELECT })
      )
      const result = await resolveStoredCard({
        prisma: deps.prisma,
        row,
        query: parseCardQuery(c.req),
        kinds: deps.kinds
      })
      if (result.status === 'refused') return refuse(c)
      if (result.status === 'off') return toStaticImage(c, 'fallback')
      // Another kind's 200 would stay in crawler caches for an hour; the static image is short-lived.
      if (result.status === 'unavailable')
        return toStaticImage(c, result.reason === 'shed' ? 'chat-shed' : 'chat-unavailable')
      const { card } = result

      const etag = `"${card.v}"`
      const headers = {
        'Cache-Control': 'public, max-age=3600',
        ETag: etag,
        'X-Robots-Tag': 'noindex'
      }
      if (etagMatches(c.req.header('if-none-match'), etag)) {
        socialCardRequestsTotal.inc({ outcome: 'not-modified' })
        return c.body(null, 304, headers)
      }

      const key = `${card.kind}:${documentId}:${card.v}`
      let png = cache.get(key)
      if (png) {
        socialCardRequestsTotal.inc({ outcome: 'hit' })
      } else {
        const rendered = await render(key, () =>
          slot(async () => {
            const stop = socialCardRenderSeconds.startTimer({ kind: card.kind })
            try {
              return await renderPng(await card.build())
            } finally {
              stop()
            }
          })
        )
        if (rendered === SHED) return toStaticImage(c, 'slot-shed')
        cache.set(key, rendered)
        png = rendered
        socialCardRequestsTotal.inc({ outcome: 'render' })
      }
      // Hono answers HEAD through this route; without the header, Bun sends Content-Length: 0.
      return c.body(png, 200, {
        ...headers,
        'Content-Type': 'image/png',
        'Content-Length': String(png.byteLength)
      })
    } catch (err) {
      deps.logger.error({ err, documentId }, 'social card failed')
      return toStaticImage(c, 'error')
    }
  })

  // The link hovercard for another pad, by slug. Two segments, so `/:docName` never shadows it.
  router.get(
    HOVERCARD_ROUTE,
    deps.optionalPadReader,
    createHovercardHandler({
      prisma: deps.prisma,
      logger: deps.logger,
      chat: deps.hovercardChat ?? createHovercardChatRead()
    })
  )

  return router
}

/**
 * Answers a URL of this REST's own card route in process, and null for any other URL. The
 * hovercard relay uses it: over the network, every reader's fetch arrives from the server's
 * one address, and they all share one rate bucket.
 */
export const createOwnCardImage = (router: Hono, publicUrl: string | null) => {
  const origin = publicUrl ? URL.parse(publicUrl)?.origin : undefined
  return (url: string): Promise<Response> | null => {
    const parsed = URL.parse(url)
    if (!origin || parsed?.origin !== origin || !isSocialCardPath(parsed.pathname)) return null
    const path = `${parsed.pathname.slice(SOCIAL_CARD_MOUNT_PATH.length)}${parsed.search}`
    return Promise.resolve(router.request(path))
  }
}
