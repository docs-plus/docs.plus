import type { Node } from '@takumi-rs/core'

import type { CardKind, CardQuery } from '../cardRequest'
import type { IsDrawable } from '../eligibility'
import type { StoredBlock, StoredChangeSummary, StoredOutline } from '../storedData'

/** One eligible pad, with its stored card data parsed once. */
export interface CardSource {
  /** The Pad title, cleaned and drawable: what `og:title` keeps. */
  padTitle: string
  /** The name the card draws: the Pad title, or the Title when the Pad title equals the slug. */
  padName: string
  /** The pad's first blocks; null when the worker has not stored card data. */
  blocks: StoredBlock[] | null
  outline: StoredOutline | null
  query: CardQuery
  facts: CardFacts
  /** The English-only check for one drawn line, injected so layout tests need no font file. */
  isDrawable: IsDrawable
}

/** A message as the anon read returns it. Never its text, never its author. */
interface MessageFacts {
  createdAt: Date
  type: string
  reactions: Record<string, number>
  replies: number
}

/** A chat room the anon read found. `headingId` null is the pad's own room. */
export interface ChatFacts {
  headingId: string | null
  /** Live messages counted, up to 10. */
  count: number
  /** Present only when the link names a message and the read found it. */
  message: MessageFacts | null
}

export interface VersionFacts {
  version: number
  createdAt: Date
  summary: StoredChangeSummary
}

/** What the reads found for this request. Null: no read was made, or it found nothing. */
export interface CardFacts {
  chat: ChatFacts | null
  version: VersionFacts | null
}

/** A card one kind can draw for this request. */
export interface DrawnCard {
  kind: CardKind
  /** Every drawn value, with a layout tag first. `cardVersion` hashes them. */
  values: string[]
  /** `og:title`, or null to keep the Pad title. */
  ogTitle: string | null
  /** The image alt text, from drawn values only. */
  alt: string
  build: () => Promise<Node>
}

/** Null means this kind cannot draw the request, so the dispatcher falls back to the Document card. */
export type KindResolver = (source: CardSource) => Promise<DrawnCard | null>
