import { padUrlCore } from '@docs.plus/pad-url'

import { plural } from '../../../../lib/cardText'
import { cutLine } from '../../render/fit'
import { cardFrame, factChip, filterChip, read, row, T } from '../../render/frame'
import { chipWidth, eyebrowLine, fitChips } from '../../render/parts'
import { type IsDrawable, usableLine } from '../eligibility'
import type { StoredOutlineItem } from '../storedData'
import { altSentences, eyebrowText } from './text'
import type { KindResolver } from './types'

const LINK = 'Open these sections →'
/** At most 3 term chips, then a "+N" chip. */
const SHOWN_CHIPS = 3

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

/**
 * The chips the title row draws, then the count its "+N" chip shows. A chip that would pass the
 * line's end is left out and counted in "+N"; one stored word wider than the line is cut.
 */
const drawnChips = async (chips: string[], more: number) => {
  const plusW = async (n: number) => (n > 0 ? T.chip.gap + (await chipWidth(`+${n}`)) : 0)
  const kept = await fitChips(chips, T.box.width, (left) => plusW(left + more))
  if (!kept.length) {
    const room =
      T.box.width - (await plusW(chips.length - 1 + more)) - 2 * (T.chip.padX + T.chip.border)
    kept.push((await cutLine(chips[0], room, T.chip.size, T.chip.weight)).text)
  }
  return { kept, plus: chips.length - kept.length + more }
}

/** The filter chips from stored matched text, the matching section names, and how many match. */
export const resolveFilter: KindResolver = async (source) => {
  const { padName, outline, query, isDrawable } = source
  if (!outline || !query.t) return null
  const { chips, hits } = matchFilter(outline.items, query.t, query.mode ?? 'or', isDrawable)
  if (!hits.length || !chips.length) return null

  const n = hits.length
  const shown = chips.slice(0, SHOWN_CHIPS)
  const { kept, plus } = await drawnChips(shown, chips.length - shown.length)
  const drawn = [...kept, ...(plus > 0 ? [`+${plus}`] : [])]
  const names = hits.map((h) => h.text).join(' · ')
  const fact = `${n} ${plural(n, 'matching section', 'matching sections')}`
  return {
    kind: 'filter',
    values: [padName, ...drawn, names, fact],
    ogTitle: padName,
    ogDescription: `${n} ${plural(n, 'section', 'sections')} of ${padName} ${plural(n, 'matches', 'match')} "${chips.join(', ')}".`,
    alt: altSentences([kept.join(', '), eyebrowText([padName, 'Filtered'])]),
    build: async () => {
      const { size, weight, marginBottom } = T.filter
      const line = await cutLine(names, T.box.width, size, weight)
      return cardFrame({
        eyebrow: await eyebrowLine(padName, ' › Filtered'),
        title: row(
          [
            ...kept.map((chip) => filterChip(chip)),
            ...(plus > 0 ? [filterChip(`+${plus}`, true)] : [])
          ],
          { gap: T.chip.gap, marginBottom }
        ),
        under: [
          read(line.text, {
            size,
            weight,
            lineHeight: T.desc.lineHeight,
            style: { whiteSpace: 'nowrap' }
          })
        ],
        footLeft: factChip(fact),
        link: LINK
      })
    }
  }
}
