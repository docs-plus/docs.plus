import type { FilterMode } from '@docs.plus/pad-url'
import { apiBaseUrl } from '@utils/apiBaseUrl'

import type { InternalDocumentLink } from '../types'

/** The `data` of `GET /api/documents/:slug/hovercard`, or the same shape built from the open editor. */
export type CardReply =
  | { locked: true }
  | { kind: 'pad'; title: string; sections: string[]; total: number }
  | {
      kind: 'heading'
      padTitle: string
      title: string
      trail: string[]
      subsections: number
      /** One per paragraph or list item, the first two. */
      lines: string[]
      /** `null` is unknown: the editor holds no per-heading total, and the route may omit it. */
      messages: number | null
    }
  | {
      kind: 'chat'
      padTitle: string
      heading: string
      trail: string[]
      messages: number
      lastMessageAt?: string
    }
  | {
      kind: 'message'
      padTitle: string
      heading: string
      trail: string[]
      sentAt: string
      replies: number
      reactions: number
    }
  | {
      kind: 'filter'
      padTitle: string
      terms: string[]
      mode: FilterMode
      shown: string[]
      shownCount: number
      total: number
    }
  | {
      kind: 'version'
      padTitle: string
      version: number
      name?: string
      savedAt: string
      sectionsChanged?: number
      wordsAdded?: number
      wordsRemoved?: number
    }
  | { kind: 'history'; padTitle: string; versions: number; lastSavedAt?: string }

export type CardFactIcon = 'sections' | 'messages' | 'date' | 'replies' | 'reactions' | 'versions'

type CardFact = { icon: CardFactIcon; text: string }

/** What a pad card draws above its link line once the route or the editor answers. */
export type CardView =
  | { state: 'locked' }
  | {
      state: 'data'
      title: string
      /** Pad title, then parent headings. Plain text, never the title again. */
      crumbs: string[]
      facts: CardFact[]
      rail: Rail | null
      description: string | null
    }

const RAIL_ITEMS = 2

const isText = (value: unknown): value is string => typeof value === 'string'
const isCount = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0
const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isText)
const optional = <T>(value: unknown, guard: (v: unknown) => v is T): boolean =>
  value === undefined || value === null || guard(value)

/** A newer server may add fields; a reply that breaks a field the card reads is no reply. */
export const parseCardReply = (data: unknown): CardReply | null => {
  const r = data as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return null
  if (r.locked === true) return { locked: true }
  const trailOk = isText(r.padTitle) && isTextList(r.trail)
  switch (r.kind) {
    case 'pad':
      return isText(r.title) && r.title && isTextList(r.sections) && isCount(r.total)
        ? (r as CardReply)
        : null
    case 'heading': {
      if (!trailOk || !isText(r.title) || !r.title || !isCount(r.subsections)) return null
      if (!isTextList(r.lines) || !optional(r.messages, isCount)) return null
      return {
        ...(r as Extract<CardReply, { kind: 'heading' }>),
        messages: isCount(r.messages) ? r.messages : null
      }
    }
    case 'chat':
      return trailOk &&
        isText(r.heading) &&
        isCount(r.messages) &&
        optional(r.lastMessageAt, isText)
        ? (r as CardReply)
        : null
    case 'message':
      return trailOk &&
        isText(r.heading) &&
        isText(r.sentAt) &&
        isCount(r.replies) &&
        isCount(r.reactions)
        ? (r as CardReply)
        : null
    case 'filter':
      return isText(r.padTitle) &&
        isTextList(r.terms) &&
        r.terms.length > 0 &&
        (r.mode === 'and' || r.mode === 'or') &&
        isTextList(r.shown) &&
        isCount(r.shownCount) &&
        isCount(r.total)
        ? (r as CardReply)
        : null
    case 'version':
      return isText(r.padTitle) &&
        isCount(r.version) &&
        isText(r.savedAt) &&
        optional(r.name, isText) &&
        optional(r.sectionsChanged, isCount) &&
        optional(r.wordsAdded, isCount) &&
        optional(r.wordsRemoved, isCount)
        ? (r as CardReply)
        : null
    case 'history':
      return isText(r.padTitle) && isCount(r.versions) && optional(r.lastSavedAt, isText)
        ? (r as CardReply)
        : null
    default:
      return null
  }
}

/** `1 section`, `2 sections`. */
const counted = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** `Nov 2`; a date in another year adds it, so an old date never reads as this year. */
const formatCardDate = (iso: string, now = new Date()): string | null => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  })
}

const quoted = (term: string): string => `“${term}”`

/** `Filter for “a” and “b”`; or-mode reads "or"; four or more terms end in `and N more terms`. */
export const filterTitle = (terms: string[], mode: FilterMode): string => {
  const join = mode === 'and' ? 'and' : 'or'
  const shown = terms.map(quoted)
  if (shown.length === 1) return `Filter for ${shown[0]}`
  if (shown.length > 3) {
    return `Filter for ${shown[0]}, ${shown[1]} ${join} ${terms.length - 2} more terms`
  }
  return `Filter for ${shown.slice(0, -1).join(', ')} ${join} ${shown.at(-1)}`
}

type Rail = { items: string[]; more: number }

const rail = (items: string[], total: number): Rail | null => {
  const head = items.slice(0, RAIL_ITEMS)
  return head.length ? { items: head, more: Math.max(0, total - head.length) } : null
}

const dated = (label: string, iso: string | undefined, now: Date): CardFact[] => {
  const date = iso ? formatCardDate(iso, now) : null
  return date ? [{ icon: 'date', text: `${label} ${date}` }] : []
}

const when = (keep: boolean, fact: CardFact): CardFact[] => (keep ? [fact] : [])

const changeLine = (reply: Extract<CardReply, { kind: 'version' }>): string | null => {
  const { sectionsChanged, wordsAdded, wordsRemoved } = reply
  if (sectionsChanged == null) return null
  const changed = `${counted(sectionsChanged, 'section')} changed`
  if (wordsAdded == null || wordsRemoved == null) return `${changed}.`
  return `${changed}: ${counted(wordsAdded, 'word')} added, ${wordsRemoved} removed.`
}

/** The rows and copy for one reply. No reply is the card's no-preview line, never this. */
export const toCardView = (reply: CardReply, now = new Date()): CardView => {
  if ('locked' in reply) return { state: 'locked' }

  const card = (
    title: string,
    crumbs: string[],
    facts: CardFact[],
    extra: { rail?: Rail | null; description?: string | null } = {}
  ): CardView => ({
    state: 'data',
    title,
    crumbs: crumbs.filter((crumb) => crumb && crumb !== title),
    facts,
    rail: extra.rail ?? null,
    description: extra.description?.trim() || null
  })

  switch (reply.kind) {
    case 'pad':
      return card(
        reply.title,
        [],
        when(reply.total > 0, { icon: 'sections', text: counted(reply.total, 'section') }),
        { rail: rail(reply.sections, reply.total) }
      )
    case 'heading':
      return card(
        reply.title,
        [reply.padTitle, ...reply.trail],
        [
          ...when(reply.subsections > 0, {
            icon: 'sections',
            text: counted(reply.subsections, 'subsection')
          }),
          ...when((reply.messages ?? 0) > 0, {
            icon: 'messages',
            text: counted(reply.messages ?? 0, 'message')
          })
        ],
        { description: reply.lines.join(' ') }
      )
    case 'chat':
      return card(
        `${reply.heading} chat`,
        [reply.padTitle, ...reply.trail],
        [
          { icon: 'messages', text: counted(reply.messages, 'message') },
          ...dated('Last message', reply.lastMessageAt, now)
        ]
      )
    case 'message':
      return card(
        `Message in ${reply.heading} chat`,
        [reply.padTitle, ...reply.trail],
        [
          ...dated('Sent', reply.sentAt, now),
          ...when(reply.replies > 0, {
            icon: 'replies',
            text: counted(reply.replies, 'reply', 'replies')
          }),
          ...when(reply.reactions > 0, {
            icon: 'reactions',
            text: counted(reply.reactions, 'reaction')
          })
        ]
      )
    case 'filter':
      return card(
        filterTitle(reply.terms, reply.mode),
        [reply.padTitle],
        [
          {
            icon: 'sections',
            text: `Shows ${reply.shownCount} of ${counted(reply.total, 'section')}`
          }
        ],
        { rail: rail(reply.shown, reply.shownCount) }
      )
    case 'version': {
      const number = `Version ${reply.version}`
      return card(
        reply.name?.trim() || number,
        [reply.padTitle, 'Version history'],
        [
          ...when(Boolean(reply.name?.trim()), { icon: 'versions', text: number }),
          ...dated('Saved', reply.savedAt, now)
        ],
        { description: changeLine(reply) }
      )
    }
    case 'history':
      return card(
        'Version history',
        [reply.padTitle],
        [
          { icon: 'versions', text: counted(reply.versions, 'version') },
          ...dated('Last saved', reply.lastSavedAt, now)
        ]
      )
  }
}

/** The route query for one link: only its own kind's params go. */
export const cardQuery = (link: InternalDocumentLink): URLSearchParams => {
  const query = new URLSearchParams()
  switch (link.kind) {
    case 'history':
      if (link.version != null) query.set('version', String(link.version))
      else query.set('history', '1')
      break
    case 'filter':
      for (const term of link.terms) query.append('terms', term)
      query.set('mode', link.mode)
      break
    case 'chat':
      query.set('chatroom', link.linkId)
      if (link.messageId) query.set('msg_id', link.messageId)
      break
    case 'heading':
      query.set('id', link.headingId)
      break
    case 'document':
      break
  }
  return query
}

/** `GET /api/documents/:slug/hovercard` with only the params of one link kind. */
export const hovercardUrl = (slug: string, query: URLSearchParams): string => {
  const search = query.toString()
  return `${apiBaseUrl()}/documents/${encodeURIComponent(slug)}/hovercard${search ? `?${search}` : ''}`
}

/**
 * One call to the card route. `null` for a non-2xx answer or a body that is not a card.
 * A network error or an abort still throws: each caller keeps its own request options and
 * its own catch. Loads no Supabase, so the paste title stays token-free.
 */
export const fetchCardReply = async (
  slug: string,
  query: URLSearchParams,
  init: RequestInit
): Promise<CardReply | null> => {
  const response = await fetch(hovercardUrl(slug, query), init)
  if (!response.ok) return null
  const body: { data?: unknown } | null = await response.json()
  return parseCardReply(body?.data)
}
