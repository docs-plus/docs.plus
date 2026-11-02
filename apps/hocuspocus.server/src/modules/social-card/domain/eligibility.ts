/** The row fields the card decision reads. The slug read and the card route both select them. */
export interface CardRow {
  documentId: string
  title: string | null
  isPrivate: boolean
  ownerId: string | null
  deletedAt: Date | null
}

// A bare domain with no `/` stays text, so a title such as "docs.plus" survives.
const URL_PATTERN = String.raw`https?:\/\/\S+|\bwww\.\S+|\b[\w-]+(\.[\w-]+)+\/\S*`
export const LINK_WORD = '[link]'

/** Every drawn line goes through this before any check or fit, so a URL never reaches a card. */
const cleanLine = (line: string): string =>
  line.replace(new RegExp(URL_PATTERN, 'g'), LINK_WORD).replace(/\s+/g, ' ').trim()

const onlyLinks = (line: string): boolean =>
  line
    .split(LINK_WORD)
    .join('')
    .replace(/[\s\p{P}]/gu, '') === ''

/** Whether the card font and Twemoji can draw a line; `infra/assets.ts` holds the real one. */
export type IsDrawable = (line: string) => boolean

/** One drawn line after the cleaner, or null when nothing drawable is left. */
export const usableLine = (
  line: string | null | undefined,
  isDrawable: IsDrawable
): string | null => {
  if (!line) return null
  const clean = cleanLine(line)
  return clean && !onlyLinks(clean) && isDrawable(clean) ? clean : null
}

/**
 * The one card eligibility rule: a live, public, owned row with a drawable Pad title.
 * Returns the title to draw, or null. Every null answers the same 404 on the route.
 */
export const drawnTitle = (row: CardRow | null, isDrawable: IsDrawable): string | null => {
  if (!row || row.deletedAt || row.isPrivate || !row.ownerId) return null
  return usableLine(row.title, isDrawable)
}

/**
 * The name a card draws: a Pad title still equal to the slug says nothing, so the
 * Title replaces it when the Title is drawable. `og:title` keeps the Pad title.
 */
export const drawnPadName = (
  padTitle: string,
  slug: string,
  titleText: string | null,
  isDrawable: IsDrawable
): string => {
  if (padTitle !== slug) return padTitle
  return usableLine(titleText, isDrawable) ?? padTitle
}
