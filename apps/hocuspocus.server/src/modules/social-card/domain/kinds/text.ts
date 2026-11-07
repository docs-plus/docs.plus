import { countBucket, plural } from '../../../../lib/cardText'
import { type IsDrawable, LINK_WORD, usableLine } from '../eligibility'
import type { StoredBlock, StoredOutlineItem } from '../storedData'
import type { CardSource, ChatFacts } from './types'

/** One drawable first-block line: a paragraph, or one list item. */
interface BlockLine {
  kind: 'p' | 'item'
  text: string
}

/**
 * Skips a block that means nothing once its links are gone: fewer than 4 words beside a
 * `[link]`. Also skips a lead-in that ends in ":", for a block the card does not draw.
 */
const meaningful = (line: string): boolean => {
  if (/:\s*$/u.test(line)) return false
  const words = line.split(LINK_WORD).join(' ').replace(/\p{P}/gu, ' ').split(/\s+/).filter(Boolean)
  if (line.includes(LINK_WORD) && words.length < 4) return false
  return words.length > 0
}

export const sameText = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/**
 * The outline section an id names, with its drawn heading text. Null when the id is unknown,
 * the text is not drawable, or it repeats the pad name: then it says nothing new.
 */
export const namedSection = (
  { outline, padName, isDrawable }: Pick<CardSource, 'outline' | 'padName' | 'isDrawable'>,
  id: string | null | undefined
): { item: StoredOutlineItem; name: string } | null => {
  const item = id ? outline?.items.find((it) => it.id === id) : undefined
  const name = item ? usableLine(item.text, isDrawable) : null
  return item && name && !sameText(name, padName) ? { item, name } : null
}

export const firstLines = (blocks: StoredBlock[], isDrawable: IsDrawable): BlockLine[] =>
  blocks.flatMap((block): BlockLine[] => {
    if (block.kind === 'paragraph') {
      const text = usableLine(block.text, isDrawable)
      return text && meaningful(text) ? [{ kind: 'p', text }] : []
    }
    return block.items.flatMap((item): BlockLine[] => {
      const text = usableLine(item.text, isDrawable)
      return text && meaningful(text) ? [{ kind: 'item', text }] : []
    })
  })

/**
 * Alt text, one sentence per part. A stored line cut mid-word goes back to its last whole word,
 * and a part that already ends in a stop gets no second one.
 */
export const altSentences = (parts: string[]): string =>
  parts
    .map((part) => {
      const whole = part.endsWith('…') ? `${part.slice(0, -1).replace(/\s+\S*$/u, '')}…` : part
      return /[.!?…]$/u.test(whole) ? whole : `${whole}.`
    })
    .join(' ')

/**
 * The room name: the stored text of the channel's heading. The pad's own room has no heading
 * and no name of its own in the app, so it gets no card. Null also when the name is the pad name.
 */
export const roomName = (source: CardSource): string | null =>
  namedSection(source, source.facts.chat?.headingId)?.name ?? null

/** "3 messages" for a room with messages, else null. Drawn as "💬 3 messages". */
export const messageCount = (chat: ChatFacts): string | null => {
  const bucket = countBucket(chat.count)
  return bucket ? `${bucket} ${plural(chat.count, 'message', 'messages')}` : null
}

/** The small line's parts, joined as drawn; the alt text joins them the same way. */
export const eyebrowText = (parts: string[]): string => parts.join(' › ')
