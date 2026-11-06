import { padUrlCore } from '@docs.plus/pad-url'
import { container } from '@takumi-rs/helpers'

import { plural } from '../../../../lib/cardText'
import { cutLine, fitHead, HEAD_LINE, LADDER, widthOf } from '../../render/fit'
import {
  BODY_H,
  cardFrame,
  CONTENT_W,
  HEAD_EXTRA,
  icon,
  LINE_H,
  mixOklab,
  muted,
  over,
  read,
  row,
  T
} from '../../render/frame'
import { outlineRow, tocHeader } from '../../render/parts'
import { type IsDrawable, usableLine } from '../eligibility'
import type { StoredOutlineItem } from '../storedData'
import type { KindResolver } from './types'

interface FilterMatch {
  /** Per term with a match: the stored text it matched, folded as a URL term is. */
  chips: string[]
  /** The drawable headings that match, in outline order. */
  hits: { text: string; level: number }[]
}

/** A chip draws the stored run a term matched, lowercase with one `-` per gap. Never the URL text. */
const fold = (text: string) => text.toLowerCase().replace(/[\s-]+/gu, '-')

const WORD_CHAR = /[\p{L}\p{N}]/u

/** The whole words a match touches, so a link cannot cut a fragment out of a stored word. */
const wholeWords = (text: string, match: RegExpExecArray): string => {
  let start = match.index
  let end = start + match[0].length
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1
  return text.slice(start, end)
}

/**
 * Matches the terms against the stored headings only; the app's filter also reads section
 * bodies. A term with no match draws no chip, so a made-up URL cannot print its own words.
 */
export const matchFilter = (
  items: StoredOutlineItem[],
  terms: string[],
  mode: 'or' | 'and',
  isDrawable: IsDrawable
): FilterMatch => {
  const headings = items.flatMap((item) => {
    const text = usableLine(item.text, isDrawable)
    return text ? [{ text, level: item.level }] : []
  })
  // Without the `g` flag, so `test` keeps no state between headings.
  const patterns = terms.flatMap((term) => {
    const pattern = padUrlCore.termPattern(term)
    return pattern ? [new RegExp(pattern.source, 'iu')] : []
  })
  const chips = patterns.flatMap((pattern) => {
    for (const { text } of headings) {
      const match = pattern.exec(text)
      if (match) return [fold(wholeWords(text, match))]
    }
    return []
  })
  const hits = headings.filter((h) =>
    mode === 'and' ? patterns.every((p) => p.test(h.text)) : patterns.some((p) => p.test(h.text))
  )
  return { chips, hits }
}

const CHIP = {
  fill: over(T.info, 0.1, T.paper),
  border: over(T.info, 0.3, T.paper),
  ink: mixOklab(T.info, T.ink, 0.42)
}
const CHIP_H = 60
const CHIP_ROW_H = 70
const GAP = T.space[2]

const chip = (text: string) =>
  row([read(text, { color: CHIP.ink, weight: T.weight.semibold, lineHeight: 1 })], {
    height: CHIP_H,
    paddingLeft: T.space[3],
    paddingRight: T.space[3],
    backgroundColor: CHIP.fill,
    border: `${T.hairline}px solid ${CHIP.border}`,
    borderRadius: T.radiusField
  })

/** The FilterBar chips from stored matched text, the mode, the count, then the matching rows. */
export const resolveFilter: KindResolver = async ({ padName, outline, query, isDrawable }) => {
  if (!outline || !query.t) return null
  const mode = query.mode ?? 'or'
  const { chips, hits } = matchFilter(outline.items, query.t, mode, isDrawable)
  if (!hits.length || !chips.length) return null

  const countText = `${hits.length} ${plural(hits.length, 'section matches', 'sections match')}`
  const modeText = chips.length > 1 ? (mode === 'and' ? 'Match all' : 'Match any') : null
  const minLevel = Math.min(...hits.map((h) => h.level))
  // The draw nests one step at most, so the version hashes that depth, not the raw level.
  const rows = hits.map((h) => ({ text: h.text, depth: Math.min(1, h.level - minLevel) }))
  return {
    kind: 'filter',
    values: [
      'filter-chips',
      padName,
      modeText ?? '',
      ...chips,
      countText,
      ...rows.map((r) => `${r.depth}:${r.text}`)
    ],
    ogTitle: null,
    alt: `${padName}. Filter: ${chips.join(', ')}. ${countText}`,
    build: async () => {
      const title = await fitHead(padName, LADDER.object, CONTENT_W, HEAD_LINE)
      const chipW = await Promise.all(
        chips.map(
          async (c) =>
            (await widthOf(c, T.size.read, T.weight.semibold)) + 2 * T.space[3] + 2 * T.hairline
        )
      )
      const modeRoom = modeText
        ? (await widthOf(modeText)) + 2 * T.space[2] + 2 * T.hairline + GAP
        : 0
      // The filter glyph, then each chip that fits beside the mode label.
      let used = T.size.read + GAP
      const kept: string[] = []
      for (const [i, text] of chips.entries()) {
        if (used + chipW[i] + GAP > CONTENT_W - modeRoom) break
        kept.push(text)
        used += chipW[i] + GAP
      }
      if (!kept.length) {
        // One stored match wider than the row: draw it cut, so the card still names the filter.
        const room = CONTENT_W - used - modeRoom - 2 * T.space[3] - 3 * GAP
        const cut = await cutLine(chips[0], room, T.size.read, T.weight.semibold)
        kept.push(cut.text)
        used += room + 2 * T.space[3] + GAP
      }
      used += modeRoom
      const countInline = used + T.space[2] + (await widthOf(countText)) <= CONTENT_W
      const count = muted(countText, {}, 1)
      const modeLabel = modeText
        ? row([read(modeText, { color: T.ink70, lineHeight: 1 })], {
            height: CHIP_H,
            paddingLeft: T.space[2],
            paddingRight: T.space[2],
            border: `${T.hairline}px solid ${T.border}`,
            borderRadius: T.radiusField
          })
        : null
      const chipRow = row(
        [
          icon('filter', T.size.read, 0.7),
          ...kept.map(chip),
          ...(modeLabel ? [modeLabel] : []),
          ...(countInline
            ? [container({ style: { width: T.space[2], flexShrink: 0 } }), count]
            : [])
        ],
        { gap: GAP, height: CHIP_ROW_H, width: CONTENT_W }
      )
      const rowsRoom =
        BODY_H - title.height - HEAD_EXTRA - CHIP_ROW_H - T.space[1] - (countInline ? 0 : LINE_H)
      const k = Math.max(0, Math.min(rows.length, Math.floor(rowsRoom / LINE_H)))
      const rowNodes = await Promise.all(rows.slice(0, k).map((r) => outlineRow(r.text, r.depth)))
      return cardFrame('filter', [
        tocHeader(title),
        chipRow,
        container({ style: { height: T.space[1], flexShrink: 0 } }),
        ...(countInline ? [] : [row([count], { height: LINE_H })]),
        ...rowNodes
      ])
    }
  }
}
