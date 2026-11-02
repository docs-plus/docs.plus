import type { Hono } from 'hono'

import type { PrismaClient } from '../../generated/prisma/client'
import { logger as rootLogger } from '../../lib/logger'
import {
  cardImageQuery,
  type CardKind,
  parseCardQuery,
  type QuerySource
} from './domain/cardRequest'
import type { CardSourceRow, ResolvedCard } from './domain/resolveCard'
import { createOwnCardImage, createRouter, type RouterDeps } from './http/router'
import { resolveStoredCard } from './infra/cardReads'

const logger = rootLogger.child({ module: 'social-card' })

export type InitDeps = RouterDeps & {
  /** This REST's public origin, so `ownImage` can tell its own card URLs. */
  publicUrl: string | null
}

export interface InitResult {
  router: Hono
  /** The card for one of this REST's own card URLs, read in process; null for any other URL. */
  ownImage: (url: string) => Promise<Response> | null
}

export const init = (deps: InitDeps): InitResult => {
  const router = createRouter(deps)
  return { router, ownImage: createOwnCardImage(router, deps.publicUrl) }
}

/** The `card` field of the slug read: what the page head points `og:image` at. */
export interface CardDescription {
  /** The card image query string, `v` included. */
  query: string
  /** `og:title`, or null to keep the Pad title. */
  title: string | null
  alt: string
  /** `og:url` path. */
  path: string
}

/** Only the page head asks for a card (`card=1`), so other slug reads never pay for one. */
export const wantsCard = (req: QuerySource, kinds: ReadonlySet<CardKind>): boolean =>
  kinds.size > 0 && req.query('card') === '1'

const describe = (card: ResolvedCard): CardDescription => ({
  query: cardImageQuery(card.query, card.v),
  title: card.ogTitle,
  alt: card.alt,
  path: card.path
})

/**
 * The slug reply, with `card` when the head asked for one (`withCard`, from `wantsCard`) and the
 * pad has one. The stored card data never leaves REST. A failed check keeps the static image.
 */
export const attachCard = async <T extends Omit<CardSourceRow, 'cardData'>>(args: {
  prisma: PrismaClient
  doc: T & { cardData?: unknown }
  req: QuerySource
  kinds: ReadonlySet<CardKind>
  withCard: boolean
}): Promise<Omit<T, 'cardData'> & { card?: CardDescription }> => {
  const { cardData, ...reply } = args.doc
  if (!args.withCard) return reply
  try {
    const result = await resolveStoredCard({
      prisma: args.prisma,
      row: { ...reply, cardData },
      query: parseCardQuery(args.req),
      kinds: args.kinds
    })
    // A read that failed for now still gets the Document card in the head.
    const card =
      result.status === 'ok'
        ? result.card
        : result.status === 'unavailable'
          ? result.documentCard
          : null
    return card ? { ...reply, card: describe(card) } : reply
  } catch (err) {
    logger.error({ err, documentId: reply.documentId }, 'social card check failed')
    return reply
  }
}
