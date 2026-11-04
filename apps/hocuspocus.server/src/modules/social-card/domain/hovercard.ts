import { padUrlCore } from '@docs.plus/pad-url'

import { type PmNode, storedLine, tocIdOf, topNodes } from '../../../lib/cardData'
import { keptTerms, MESSAGE_ID, type QuerySource, SUB_ID, VERSION } from './cardRequest'
import type { StoredBlock, StoredOutline } from './storedData'

/** How many lines, section titles or shown sections one card lists. */
export const HOVERCARD_LIST = 2

// The card query allows 4 terms; the pad URL allows more.
export const HOVERCARD_MAX_TERMS = 8

export type FilterMode = 'and' | 'or'

export type HovercardRequest =
  | { kind: 'message'; chatroom: string; messageId: string }
  | { kind: 'chat'; chatroom: string }
  | { kind: 'version'; version: number }
  | { kind: 'history' }
  | { kind: 'filter'; terms: string[]; mode: FilterMode }
  | { kind: 'heading'; id: string }
  | { kind: 'pad' }

/**
 * The first kind whose keys are present and well shaped, in the app's order: History first,
 * then `padUrlCore.place` (filter, chat, heading). A bad value is dropped, never a 400,
 * so it costs no read and the next kind in line answers.
 */
export const parseHovercardQuery = (req: QuerySource): HovercardRequest => {
  const version = req.query('version')
  if (version && VERSION.test(version)) return { kind: 'version', version: Number(version) }
  if (req.query('history') === '1') return { kind: 'history' }
  const terms = keptTerms(
    (req.queries('terms') ?? []).map((term) => term.toLowerCase()),
    HOVERCARD_MAX_TERMS
  )
  // The app reads a missing mode as `or`, and the pad link never writes `mode=or`.
  if (terms) return { kind: 'filter', terms, mode: req.query('mode') === 'and' ? 'and' : 'or' }
  const chatroom = req.query('chatroom')
  if (chatroom && SUB_ID.test(chatroom)) {
    const messageId = req.query('msg_id')
    if (messageId && MESSAGE_ID.test(messageId)) return { kind: 'message', chatroom, messageId }
    return { kind: 'chat', chatroom }
  }
  const id = req.query('id')
  if (id && SUB_ID.test(id)) return { kind: 'heading', id }
  return { kind: 'pad' }
}

const blockLines = (blocks: StoredBlock[]): string[] =>
  blocks.flatMap((block) =>
    block.kind === 'paragraph' ? [block.text] : block.items.map((item) => item.text)
  )

export interface HeadingFacts {
  title: string
  /** Parent heading titles, outermost first, without the Title and the heading itself. */
  trail: string[]
  subsections: number
  lines: string[]
}

/** One heading from the stored outline. Null for an id the outline does not hold. */
export const headingFacts = (outline: StoredOutline | null, id: string): HeadingFacts | null => {
  const items = outline?.items ?? []
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return null
  const item = items[index]
  const trail: string[] = []
  // `parseOutline` keeps every parent earlier than its child, so this walk ends.
  for (let parent = item.parent; parent >= 0; parent = items[parent].parent) {
    trail.unshift(items[parent].text)
  }
  let subsections = 0
  for (let i = index + 1; i < items.length && items[i].level > item.level; i += 1) subsections += 1
  return {
    title: item.text,
    trail,
    subsections,
    lines: blockLines(item.blocks).slice(0, HOVERCARD_LIST)
  }
}

interface Section {
  id: string
  level: number
  title: string
  /** The heading text node strings, then the body's, as the client walks them. */
  texts: string[]
}

/** Text node strings under `nodes`, in order. Iterative: a stored snapshot's depth is not bounded. */
const textNodes = (nodes: PmNode[]): string[] => {
  const out: string[] = []
  const stack = [...nodes].reverse()
  while (stack.length > 0) {
    const node = stack.pop() as PmNode
    if (typeof node.text === 'string') out.push(node.text)
    else if (Array.isArray(node.content)) {
      for (let i = node.content.length - 1; i >= 0; i -= 1) stack.push(node.content[i])
    }
  }
  return out
}

/** `findAllSections`: every top-level heading with a toc-id except child 0, the Title. */
const sectionsOf = (doc: unknown): Section[] => {
  const nodes = topNodes(doc)
  const sections: Section[] = []
  for (let i = 1; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node.type !== 'heading') continue
    const id = tocIdOf(node)
    if (!id) continue
    let end = i + 1
    while (end < nodes.length && nodes[end].type !== 'heading') end += 1
    const level = Number(node.attrs?.level)
    sections.push({
      id,
      level: Number.isFinite(level) ? level : 1,
      title: storedLine(textNodes([node]).join('')),
      texts: textNodes(nodes.slice(i, end))
    })
  }
  return sections
}

export interface FilterFacts {
  terms: string[]
  mode: FilterMode
  shown: string[]
  shownCount: number
  total: number
}

/**
 * Mirrors `filterSections` in the webapp's `match-section.ts`: a term matches a section when one
 * text node of its heading or body matches, and the shown set adds each match's ancestors and
 * descendants. Change both together.
 */
export const filterFacts = (doc: unknown, terms: string[], mode: FilterMode): FilterFacts => {
  const sections = sectionsOf(doc)
  const perTerm = terms.map((term) => {
    const pattern = padUrlCore.termPattern(term)
    // Without `g`, so `test` keeps no state between text nodes.
    const once = pattern ? new RegExp(pattern.source, 'iu') : null
    return new Set(
      once ? sections.filter((s) => s.texts.some((t) => once.test(t))).map((s) => s.id) : []
    )
  })
  // The parse keeps at least one term, so `perTerm[0]` exists.
  const direct =
    mode === 'or'
      ? new Set(perTerm.flatMap((ids) => [...ids]))
      : new Set([...perTerm[0]].filter((id) => perTerm.every((ids) => ids.has(id))))

  const shownIds = new Set(direct)
  const open: Section[] = []
  sections.forEach((section, index) => {
    while (open.length > 0 && open[open.length - 1].level >= section.level) open.pop()
    if (direct.has(section.id)) {
      for (const ancestor of open) shownIds.add(ancestor.id)
      for (let j = index + 1; j < sections.length && sections[j].level > section.level; j += 1) {
        shownIds.add(sections[j].id)
      }
    }
    open.push(section)
  })

  const shown = sections.filter((section) => shownIds.has(section.id))
  return {
    terms,
    mode,
    shown: shown
      .map((section) => section.title)
      .filter(Boolean)
      .slice(0, HOVERCARD_LIST),
    shownCount: shownIds.size,
    total: sections.length
  }
}

interface OnPad {
  padTitle: string
}

interface InRoom extends OnPad {
  heading: string
  trail: string[]
}

/** The reply body, one arm per link kind. Dates are ISO strings. */
export type HovercardReply =
  | { locked: true }
  | { kind: 'pad'; title: string; sections: string[]; total: number }
  /** `messages` is left out when the chat read failed. */
  | ({ kind: 'heading'; messages?: number } & OnPad & HeadingFacts)
  | ({ kind: 'chat'; messages: number; lastMessageAt?: string } & InRoom)
  | ({ kind: 'message'; sentAt: string; replies: number; reactions: number } & InRoom)
  | ({
      kind: 'version'
      version: number
      name?: string
      savedAt: string
      sectionsChanged?: number
      wordsAdded?: number
      wordsRemoved?: number
    } & OnPad)
  | ({ kind: 'history'; versions: number; lastSavedAt?: string } & OnPad)
  | ({ kind: 'filter' } & OnPad & FilterFacts)
