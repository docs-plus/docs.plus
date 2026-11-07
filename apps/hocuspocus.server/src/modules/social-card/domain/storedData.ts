/**
 * The stored values the cards draw. The worker writes them; the card reads them back through
 * these parsers, so a malformed row draws fewer details instead of throwing.
 */

/** Cut for every stored line, in graphemes, with "…" when cut. */
export const STORED_LINE_MAX = 80
/** Lines kept for the pad's first blocks and for each section. A list counts one per item. */
export const STORED_BLOCK_LINES = 4
export const OUTLINE_MAX_ITEMS = 200
/** Above this, the worker drops each section's blocks, then the whole outline if still too big. */
export const OUTLINE_MAX_BYTES = 32 * 1024

export type ListKind = 'bullet' | 'ordered' | 'task'

/** One first block: a paragraph, or one list with its items. Pictures, code and embeds are not stored. */
export type StoredBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; list: ListKind; items: { text: string; checked?: boolean }[] }

export interface StoredOutlineItem {
  /** The heading's `toc-id`. */
  id: string
  level: number
  text: string
  /** Index of the parent item, or -1 when the heading sits right under the Title. */
  parent: number
  /** The section's own first blocks, up to `STORED_BLOCK_LINES` lines. Dropped when too big. */
  blocks: StoredBlock[]
}

/** Every heading after the Title, in document order. */
export interface StoredOutline {
  /** Text of the Title (`content[0]`). It replaces a Pad title that is still the slug. */
  title: string | null
  titleId: string | null
  /** Items stop at `OUTLINE_MAX_ITEMS`. */
  truncated?: true
  items: StoredOutlineItem[]
}

/** `DocumentMetadata.cardData`: what the worker stored for the card from the head snapshot. */
export interface StoredCardData {
  v: 1
  /** The first paragraphs and lists after the Title. */
  blocks: StoredBlock[]
  /** Null when even the outline without blocks is too big to store. */
  outline: StoredOutline | null
}

/** `Documents.changeSummary`: this version against the one before it. */
export interface StoredChangeSummary {
  v: 1
  /** This version's own Title text, not the head's. */
  title: string | null
  wordsAdded: number
  wordsRemoved: number
  sectionsAdded: number
  sectionsRemoved: number
  sectionsModified: number
  sectionsMoved: number
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0
const LIST_KINDS: readonly string[] = ['bullet', 'ordered', 'task'] satisfies ListKind[]
const isListKind = (value: unknown): value is ListKind =>
  typeof value === 'string' && LIST_KINDS.includes(value)

const parseBlock = (value: unknown): StoredBlock | null => {
  if (!isObject(value)) return null
  if (value.kind === 'paragraph') {
    const text = str(value.text)
    return text ? { kind: 'paragraph', text } : null
  }
  if (value.kind !== 'list' || !isListKind(value.list)) return null
  const items = (Array.isArray(value.items) ? value.items : []).flatMap((item) => {
    const text = isObject(item) ? str(item.text) : null
    if (!text) return []
    return [item.checked === true ? { text, checked: true } : { text }]
  })
  return items.length ? { kind: 'list', list: value.list, items } : null
}

const parseBlocks = (value: unknown): StoredBlock[] =>
  Array.isArray(value) ? value.flatMap((block) => parseBlock(block) ?? []) : []

const parseOutline = (value: unknown): StoredOutline | null => {
  if (!isObject(value) || !Array.isArray(value.items)) return null
  const items: StoredOutlineItem[] = []
  for (const raw of value.items) {
    if (!isObject(raw)) return null
    const id = str(raw.id)
    const text = str(raw.text)
    const { level, parent } = raw
    if (!id || !text || typeof level !== 'number' || typeof parent !== 'number') return null
    // A parent always comes earlier, so a bad index cannot loop or point forward.
    if (!Number.isInteger(parent) || parent < -1 || parent >= items.length) return null
    // The rail count comes from the level, so an unbounded one would be unbounded work.
    if (!Number.isInteger(level) || level < 1 || level > 6) return null
    items.push({ id, level, text, parent, blocks: parseBlocks(raw.blocks) })
  }
  return {
    title: str(value.title),
    titleId: str(value.titleId),
    ...(value.truncated === true ? { truncated: true as const } : {}),
    items
  }
}

/** Null when the worker has not written the column, or wrote it fail-closed. */
export const parseCardData = (value: unknown): Omit<StoredCardData, 'v'> | null =>
  isObject(value) && value.v === 1
    ? { blocks: parseBlocks(value.blocks), outline: parseOutline(value.outline) }
    : null

export const parseChangeSummary = (value: unknown): StoredChangeSummary | null => {
  if (!isObject(value) || value.v !== 1) return null
  return {
    v: 1,
    title: str(value.title),
    wordsAdded: count(value.wordsAdded),
    wordsRemoved: count(value.wordsRemoved),
    sectionsAdded: count(value.sectionsAdded),
    sectionsRemoved: count(value.sectionsRemoved),
    sectionsModified: count(value.sectionsModified),
    sectionsMoved: count(value.sectionsMoved)
  }
}
