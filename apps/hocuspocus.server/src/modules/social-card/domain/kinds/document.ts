import { plural } from '../../../../lib/cardText'
import { type IsDrawable, usableLine } from '../eligibility'
import { fitHead, HEAD_LINE, LADDER } from '../fit'
import { BODY_H, cardFrame, CONTENT_W, HEAD_EXTRA, LINE_H, muted, T, titleNode } from '../frame'
import {
  altSentences,
  type BlockLine,
  blockLines,
  firstLines,
  lineValue,
  outlineRow,
  tocHeader
} from '../parts'
import type { StoredOutlineItem } from '../storedData'
import type { DrawnCard, KindResolver } from './types'

interface OutlineRow {
  text: string
  depth: number
}

/** The outline layout needs at least this many rows; with fewer, the first blocks say more. */
const MIN_ROWS = 3

/**
 * The rows the Document card draws. It takes the top level when that has `MIN_ROWS` or more
 * items. Else it takes the top level with its children nested under it.
 */
export const pickRows = (items: StoredOutlineItem[], isDrawable: IsDrawable): OutlineRow[] => {
  const top = items.filter((item) => item.parent === -1)
  const topIds = new Set(top.map((item) => item.id))
  const list =
    top.length >= MIN_ROWS
      ? top
      : items.filter((item) => item.parent === -1 || topIds.has(items[item.parent]?.id ?? ''))
  if (!list.length) return []
  const minLevel = Math.min(...list.map((item) => item.level))
  return list.flatMap((item) => {
    const text = usableLine(item.text, isDrawable)
    return text ? [{ text, depth: item.level - minLevel }] : []
  })
}

const MORE_H = T.size.read + T.space[1]

const outlineCard = (padName: string, rows: OutlineRow[]): DrawnCard => ({
  kind: 'document',
  values: ['document-outline', padName, ...rows.map((r) => `${r.depth}:${r.text}`)],
  ogTitle: null,
  alt: [padName, ...rows.slice(0, 4).map((r) => r.text)].join(', '),
  build: async () => {
    const title = await fitHead(padName, LADDER.object, CONTENT_W, 2 * HEAD_LINE)
    const budget = BODY_H - title.height - HEAD_EXTRA
    let k = Math.min(rows.length, Math.floor(budget / LINE_H))
    if (k < rows.length) k = Math.min(k, Math.floor((budget - MORE_H) / LINE_H))
    const shown = await Promise.all(rows.slice(0, k).map((r) => outlineRow(r.text, r.depth)))
    const more = rows.length - k
    return cardFrame('document', [
      tocHeader(title),
      ...shown,
      ...(more > 0
        ? [
            muted(
              `+${more} more ${plural(more, 'section', 'sections')}`,
              { marginTop: T.space[1] },
              1
            )
          ]
        : [])
    ])
  }
})

const titleCard = (padName: string): DrawnCard => ({
  kind: 'document',
  values: ['document-title', padName],
  ogTitle: null,
  alt: padName,
  build: async () =>
    cardFrame('document', [titleNode(await fitHead(padName, LADDER.padTitle, CONTENT_W, BODY_H))])
})

const blocksCard = (padName: string, lines: BlockLine[]): DrawnCard => ({
  kind: 'document',
  values: ['document-blocks', padName, ...lines.map(lineValue)],
  ogTitle: null,
  alt: altSentences([padName, ...lines.slice(0, 2).map((l) => l.text)]),
  build: async () => {
    const minBlocks = Math.min(2, lines.length) * LINE_H + T.space[3]
    const title = await fitHead(padName, LADDER.padTitle, CONTENT_W, BODY_H - minBlocks)
    const blocks = await blockLines(lines, BODY_H - title.height - T.space[3])
    return cardFrame('document', [titleNode(title, { marginBottom: T.space[3] }), ...blocks])
  }
})

/** The layout the Document card takes: outline rows, else first blocks, else one large title. */
export const resolveDocument: KindResolver = async (source) => {
  const rows = source.outline ? pickRows(source.outline.items, source.isDrawable) : []
  if (rows.length >= MIN_ROWS) return outlineCard(source.padName, rows)
  const lines = firstLines(source.blocks ?? [], source.isDrawable)
  return lines.length ? blocksCard(source.padName, lines) : titleCard(source.padName)
}
