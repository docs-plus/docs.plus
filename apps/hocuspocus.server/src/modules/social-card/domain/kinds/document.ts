import type { Node } from '@takumi-rs/core'

import { peopleCount, peopleLabel, plural } from '../../../../lib/cardText'
import { cutLine, footLeftWidth } from '../../render/fit'
import { cardFrame, peopleRow, read, T } from '../../render/frame'
import { fitMiddle } from '../../render/parts'
import { type IsDrawable, usableLine } from '../eligibility'
import type { StoredOutlineItem } from '../storedData'
import { altSentences, firstLines, sameText } from './text'
import type { DrawnCard, KindResolver } from './types'

interface OutlineRow {
  text: string
  depth: number
}

/** With fewer top-level rows than this, their children count as sections too. */
const MIN_ROWS = 3

/**
 * The pad's sections, in order. It takes the top level when that has `MIN_ROWS` or more
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

const LINK = 'Open the document →'
const SHOWN_SECTIONS = 3

/**
 * "Curry / daal · Pasta Bake · Soups · +5 more", or null with no section to name. A truncated
 * outline hides how many sections remain, so its tail says "+ more" with no number.
 */
const sectionsLine = (rows: OutlineRow[], truncated: boolean): string | null => {
  if (!rows.length) return null
  const names = rows.slice(0, SHOWN_SECTIONS).map((r) => r.text)
  const more = rows.length - names.length
  const tail = truncated ? ['+ more'] : more > 0 ? [`+${more} more`] : []
  return [...names, ...tail].join(' · ')
}

/**
 * One sentence per fact a reader may see, or null with nothing to say. A hidden count leaves its
 * part out, and a truncated outline gives a floor ("200+ sections"), never a false total.
 */
const describe = (members: number | null, sections: number, truncated: boolean): string | null => {
  const counted =
    sections > 0
      ? `${sections}${truncated ? '+' : ''} ${plural(sections, 'section', 'sections')}`
      : null
  const people = peopleCount(members)
  if (!people) return counted ? `A document on docs.plus with ${counted}.` : null
  const working = `${people} people are working on this document.`
  if (!counted) return working
  return `${working} ${counted}, ${plural(sections, 'with its own chat', 'with chat on each one')}.`
}

/** The foot clips with no "…", so the line is cut here, at a word when it can be. */
const sectionsFoot = async (line: string): Promise<Node> => {
  const fit = await cutLine(line, await footLeftWidth(LINK), T.sections.size, T.sections.weight)
  return read(fit.text, {
    ...T.sections,
    color: T.inkSoft,
    style: { whiteSpace: 'nowrap' }
  })
}

/**
 * The name, then the first paragraph, else the section names. The foot holds the people count
 * from 3 people; else the section names when the paragraph took the middle.
 */
export const resolveDocument: KindResolver = async (source): Promise<DrawnCard> => {
  const name = source.padName
  const desc =
    firstLines(source.blocks ?? [], source.isDrawable).find(
      (line) => line.kind === 'p' && !sameText(line.text, name)
    )?.text ?? null
  const truncated = source.outline?.truncated === true
  // A section named like the pad would print the name twice.
  const rows = source.outline ? pickRows(source.outline.items, source.isDrawable) : []
  const sections = sectionsLine(
    rows.filter((row) => !sameText(row.text, name)),
    truncated
  )
  const people = peopleLabel(source.facts.members)
  const middle = desc ?? sections
  return {
    kind: 'document',
    values: [name, desc ?? '', sections ?? '', people ?? ''],
    ogTitle: source.renamed ? name : null,
    ogDescription: describe(source.facts.members, source.outline?.items.length ?? 0, truncated),
    alt: altSentences(middle ? [name, middle] : [name]),
    build: async () => {
      const { title, under } = await fitMiddle(name, middle, false)
      const footLeft = people
        ? peopleRow(people)
        : desc && sections
          ? await sectionsFoot(sections)
          : undefined
      return cardFrame({ title, under, footLeft, link: LINK })
    }
  }
}
