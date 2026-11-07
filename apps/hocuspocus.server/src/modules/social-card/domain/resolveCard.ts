import { padLink } from '../../../lib/padLink'
import type { CardKind, CardQuery } from './cardRequest'
import { cardVersion } from './cardVersion'
import { cardName, type CardRow, type IsDrawable } from './eligibility'
import { resolveChat } from './kinds/chat'
import { resolveDocument } from './kinds/document'
import { resolveFilter } from './kinds/filter'
import { resolveHeading } from './kinds/heading'
import { resolveMessage } from './kinds/message'
import type { CardFacts, ChatFacts, DrawnCard, KindResolver, VersionFacts } from './kinds/types'
import { resolveVersion } from './kinds/version'
import { parseCardData, type StoredOutline } from './storedData'

/** The row columns a card reads: the eligibility fields and the stored card data. */
export interface CardSourceRow extends CardRow {
  cardData: unknown
}

/** `CardSourceRow` as a Prisma select: the card route and a slug read that asks for a card. */
export const CARD_ROW_SELECT = {
  documentId: true,
  title: true,
  isPrivate: true,
  ownerId: true,
  deletedAt: true,
  slug: true,
  cardData: true
} as const

/** A read that may succeed on a retry. It is never remembered, and never drawn as another kind. */
export type Indefinite = 'shed' | 'unavailable'

/** The reads a card may need. Null is a definite miss, except for `members`. */
export interface CardReads {
  chat: (
    documentId: string,
    linkId: string,
    messageId?: string
  ) => Promise<ChatFacts | null | Indefinite>
  version: (documentId: string, version: number) => Promise<VersionFacts | null>
  /** The pad's member count. Null on any failure: the card then draws with no count. */
  members: (documentId: string) => Promise<number | null>
}

export interface ResolvedCard extends DrawnCard {
  v: string
  /** The sub-ids this card used; the image URL carries these and no others. */
  query: CardQuery
  /** `og:url` path for this kind. A filter link never carries its raw terms. */
  path: string
}

const RESOLVERS: Record<CardKind, KindResolver> = {
  document: resolveDocument,
  heading: resolveHeading,
  chat: resolveChat,
  message: resolveMessage,
  version: resolveVersion,
  filter: resolveFilter
}

/** The most specific kind the link asks for, and only the sub-ids that kind reads. */
const requestedKind = (query: CardQuery): { kind: CardKind; query: CardQuery } => {
  if (query.version) return { kind: 'version', query: { version: query.version } }
  if (query.c && query.m) return { kind: 'message', query: { c: query.c, m: query.m } }
  if (query.c) return { kind: 'chat', query: { c: query.c } }
  if (query.id) return { kind: 'heading', query: { id: query.id } }
  if (query.t) {
    return { kind: 'filter', query: { t: query.t, ...(query.mode ? { mode: query.mode } : {}) } }
  }
  return { kind: 'document', query: {} }
}

const NO_FACTS: CardFacts = { chat: null, version: null, members: null }

const readFacts = async (
  documentId: string,
  kind: CardKind,
  query: CardQuery,
  reads: CardReads,
  outline: StoredOutline | null
): Promise<CardFacts | Indefinite> => {
  if ((kind === 'chat' || kind === 'message') && query.c) {
    const chat = await reads.chat(documentId, query.c, query.m)
    return typeof chat === 'string' ? chat : { ...NO_FACTS, chat }
  }
  if (kind === 'heading' && query.id) {
    // A heading the outline does not hold draws no card, so it spends no read and no slot.
    if (outline && !outline.items.some((item) => item.id === query.id)) return NO_FACTS
    // The count is extra on a Heading card, so a failed read draws the card without it.
    const chat = await reads.chat(documentId, query.id)
    return { ...NO_FACTS, chat: typeof chat === 'string' ? null : chat }
  }
  if (kind === 'version' && query.version) {
    return { ...NO_FACTS, version: await reads.version(documentId, query.version) }
  }
  return NO_FACTS
}

const pathOf = (slug: string, kind: CardKind, query: CardQuery): string => {
  if (kind === 'heading' && query.id) return padLink(slug, { kind: 'heading', headingId: query.id })
  if ((kind === 'chat' || kind === 'message') && query.c) {
    return padLink(slug, { kind: 'chat', linkId: query.c, messageId: query.m })
  }
  const base = padLink(slug, { kind: 'document' })
  return kind === 'version' && query.version ? `${base}?version=${query.version}` : base
}

/**
 * `unavailable`: the link's own read failed for now. The route then sends the short-cached
 * Fallback card, never another kind's 200; the page head may draw `documentCard` instead.
 */
export type CardResult =
  | { status: 'refused' }
  | { status: 'off' }
  | { status: 'unavailable'; reason: Indefinite; documentCard: ResolvedCard | null }
  | { status: 'ok'; card: ResolvedCard }

/**
 * The one card decision, shared by the page head and the card route. Eligibility first;
 * then the kind the link asks for, if it is on and can draw; else the Document card.
 */
export const resolveCard = async (args: {
  row: CardSourceRow | null
  query: CardQuery
  kinds: ReadonlySet<CardKind>
  reads: CardReads
  isDrawable: IsDrawable
}): Promise<CardResult> => {
  const { row, kinds, reads, isDrawable } = args
  const stored = row ? parseCardData(row.cardData) : null
  const outline = stored?.outline ?? null
  const named = cardName(row, outline?.title ?? null, isDrawable)
  if (!row || !named) return { status: 'refused' }

  const base = {
    padName: named.name,
    renamed: named.renamed,
    blocks: stored?.blocks ?? null,
    outline,
    isDrawable
  }

  const draw = async (
    kind: CardKind,
    query: CardQuery,
    facts: CardFacts
  ): Promise<ResolvedCard | null> => {
    const drawn = await RESOLVERS[kind]({ ...base, query, facts })
    if (!drawn) return null
    return {
      ...drawn,
      v: cardVersion(drawn.kind, drawn.values),
      query,
      path: pathOf(row.slug, drawn.kind, query)
    }
  }

  const wanted = requestedKind(args.query)
  // Runs beside the kind's own read, so a fallback to the Document card adds no second wait.
  const [facts, members] = await Promise.all([
    wanted.kind !== 'document' && kinds.has(wanted.kind)
      ? readFacts(row.documentId, wanted.kind, wanted.query, reads, outline)
      : null,
    kinds.has('document') ? reads.members(row.documentId) : null
  ])
  const first =
    facts && typeof facts !== 'string' ? await draw(wanted.kind, wanted.query, facts) : null
  if (first) return { status: 'ok', card: first }
  const documentCard = kinds.has('document')
    ? await draw('document', {}, { ...NO_FACTS, members })
    : null
  if (typeof facts === 'string') return { status: 'unavailable', reason: facts, documentCard }
  return documentCard ? { status: 'ok', card: documentCard } : { status: 'off' }
}
