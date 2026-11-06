import type { Node } from '@takumi-rs/core'
import { container, image } from '@takumi-rs/helpers'

import { type IsDrawable, LINK_WORD, usableLine } from '../domain/eligibility'
import type { CardSource } from '../domain/kinds/types'
import type { ListKind, StoredBlock, StoredOutlineItem } from '../domain/storedData'
import { cutLine, cutLines } from './fit'
import {
  CONTENT_W,
  LINE_H,
  NEST,
  over,
  read,
  READ_LH,
  row,
  stack,
  strokeSvg,
  T,
  titleNode
} from './frame'

/** One drawable first-block line: a paragraph, or one list item with its marker. */
export interface BlockLine {
  kind: 'p' | 'item'
  text: string
  list?: ListKind
  checked?: boolean
  /** 1-based place in its own list, for an ordered marker. */
  number?: number
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
  return item && name && name !== padName ? { item, name } : null
}

export const firstLines = (blocks: StoredBlock[], isDrawable: IsDrawable): BlockLine[] =>
  blocks.flatMap((block): BlockLine[] => {
    if (block.kind === 'paragraph') {
      const text = usableLine(block.text, isDrawable)
      return text && meaningful(text) ? [{ kind: 'p', text }] : []
    }
    return block.items.flatMap((item, i) => {
      const text = usableLine(item.text, isDrawable)
      if (!text || !meaningful(text)) return []
      return [{ kind: 'item', text, list: block.list, checked: item.checked, number: i + 1 }]
    })
  })

/** How a line enters `cardVersion`: everything its marker and text draw. */
export const lineValue = (line: BlockLine): string =>
  line.kind === 'p'
    ? `p:${line.text}`
    : `${line.list}:${line.list === 'ordered' ? line.number : ''}:${line.checked ? 'x' : ''}:${line.text}`

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

const MARKER = 36 // the daisyUI checkbox at 2.5x

const marker = (line: BlockLine): Node => {
  if (line.list === 'task') {
    return container({
      style: {
        width: MARKER,
        height: MARKER,
        borderRadius: 12,
        border: `${T.hairline}px solid ${line.checked ? T.primary : T.ink70}`,
        backgroundColor: line.checked ? T.primary : T.paper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      },
      children: line.checked
        ? [
            image({
              src: strokeSvg('card:check', '<path d="M20 6 9 17l-5-5"/>', T.paper, 3),
              width: 28,
              height: 28
            })
          ]
        : []
    })
  }
  return read(line.list === 'ordered' ? `${line.number ?? 1}.` : '•', {
    color: T.ink70,
    lineHeight: 1
  })
}

/** The first blocks under a title, while room is left: a paragraph takes up to 2 lines, a list item 1. */
export const blockLines = async (lines: BlockLine[], room: number): Promise<Node[]> => {
  const nodes: Node[] = []
  for (let i = 0; i < lines.length && room >= LINE_H; i++) {
    const line = lines[i]
    if (line.kind === 'p') {
      const fit = await cutLines(line.text, CONTENT_W, Math.min(2, Math.floor(room / READ_LH)))
      nodes.push(read(fit.text))
      room -= fit.lines * READ_LH
      continue
    }
    const fit = await cutLine(line.text, CONTENT_W - MARKER - T.space[3])
    nodes.push(row([marker(line), read(fit.text)], { gap: T.space[3], height: LINE_H }))
    room -= LINE_H
  }
  return nodes
}

/**
 * TocHeader at 2.5x: the pad name with its bottom border. The title takes `CONTENT_W`, so it
 * wraps as `fitHead` measured it; without a width this row kept it on one line and clipped it.
 */
export const tocHeader = (title: { text: string; size: number }): Node =>
  container({
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingBottom: T.space[1],
      borderBottom: `${T.hairline}px solid ${T.border}`,
      marginBottom: T.space[1],
      flexShrink: 0,
      width: CONTENT_W
    },
    children: [titleNode(title, { width: CONTENT_W })]
  })

const rail = () =>
  container({
    style: { width: NEST, height: LINE_H, flexShrink: 0, display: 'flex', paddingLeft: T.space[2] },
    children: [
      container({
        style: { width: T.hairline, height: LINE_H, backgroundColor: T.border, flexShrink: 0 }
      })
    ]
  })

/** One TOC row: a hairline rail per nest step, then the heading cut at a word. */
export const outlineRow = async (text: string, depth: number): Promise<Node> => {
  const fit = await cutLine(text, CONTENT_W - depth * NEST)
  return container({
    style: {
      display: 'flex',
      alignItems: 'center',
      height: LINE_H,
      width: CONTENT_W,
      flexShrink: 0
    },
    children: [
      ...Array.from({ length: depth }, rail),
      container({
        style: { display: 'flex', flexGrow: 1, minWidth: 0 },
        children: [read(fit.text, { lineHeight: T.lineHeight.read })]
      })
    ]
  })
}

// The chat sketch. Every bubble is fixed decoration: no count, width or side follows data,
// so nothing leaks members, authors or presence.
const BUBBLE_PAD = 14
const BUBBLE_LINE = 12
const BUBBLE = {
  in: { fill: T.paper, line: T.border, tail: 'borderBottomLeftRadius' },
  out: {
    fill: over(T.primary, 0.14, T.well),
    line: over(T.primary, 0.3, T.well),
    tail: 'borderBottomRightRadius'
  }
} as const
const AVATAR = 40

const bubble = (side: 'in' | 'out', width: number, lines: number[]): Node => {
  const s = BUBBLE[side]
  return container({
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: BUBBLE_LINE,
      width,
      padding: BUBBLE_PAD,
      paddingLeft: BUBBLE_PAD + 4,
      paddingRight: BUBBLE_PAD + 4,
      backgroundColor: s.fill,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      // The small corner points at the sender.
      [s.tail]: 8,
      flexShrink: 0
    },
    children: lines.map((share) =>
      container({
        style: {
          width: `${share}%`,
          height: BUBBLE_LINE,
          backgroundColor: s.line,
          borderRadius: BUBBLE_LINE / 2
        }
      })
    )
  })
}

export const inBubble = (width: number, lines: number[], avatar: string = T.border): Node =>
  row(
    [
      container({
        style: {
          width: AVATAR,
          height: AVATAR,
          borderRadius: 999,
          backgroundColor: avatar,
          flexShrink: 0
        }
      }),
      bubble('in', width, lines)
    ],
    { gap: T.space[1], alignItems: 'flex-end', width: '100%' }
  )

export const outBubble = (width: number, lines: number[]): Node =>
  row([bubble('out', width, lines)], { justifyContent: 'flex-end', width: '100%' })

export const conversation = (bubbles: Node[]): Node =>
  stack(bubbles, {
    gap: T.space[1.5] - 3,
    width: '100%',
    justifyContent: 'flex-end',
    flexGrow: 1
  })
