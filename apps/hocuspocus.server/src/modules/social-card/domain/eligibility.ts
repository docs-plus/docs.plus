/** The row fields the card decision reads. The slug read and the card route both select them. */
export interface CardRow {
  documentId: string
  title: string | null
  isPrivate: boolean
  ownerId: string | null
  deletedAt: Date | null
  slug: string
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

const drawableClean = (clean: string, isDrawable: IsDrawable): string | null =>
  clean && !onlyLinks(clean) && isDrawable(clean) ? clean : null

/** One drawn line after the cleaner, or null when nothing drawable is left. */
export const usableLine = (
  line: string | null | undefined,
  isDrawable: IsDrawable
): string | null => (line ? drawableClean(cleanLine(line), isDrawable) : null)

// The letters of `[link]` must not count, or a Title made only of links would pass.
const hasWord = (line: string): boolean => /[\p{L}\p{N}]/u.test(line.split(LINK_WORD).join(''))

/** A Pad title still equal to the slug says nothing, so the Title replaces it when there is one. */
export const padName = (
  padTitle: string,
  slug: string,
  titleText: string | null | undefined
): string => (padTitle !== slug ? padTitle : titleText || padTitle)

/**
 * The one card eligibility rule: a live, public, owned row with a drawable Pad title. The name
 * rule then picks the drawn name: a Pad title that is only links, or equals the slug, gives way
 * to the Title heading. `renamed` says it did. Every null answers the same 404 on the route.
 */
export const cardName = (
  row: CardRow | null,
  titleText: string | null,
  isDrawable: IsDrawable
): { name: string; renamed: boolean } | null => {
  if (!row || row.deletedAt || row.isPrivate || !row.ownerId) return null
  const clean = cleanLine(row.title ?? '')
  const own = drawableClean(clean, isDrawable)
  const heading = usableLine(titleText, isDrawable)
  if (own) {
    const name = padName(own, row.slug, heading)
    return { name, renamed: name !== own }
  }
  if (!clean.includes(LINK_WORD) || !onlyLinks(clean)) return null
  return heading && hasWord(heading) ? { name: heading, renamed: true } : null
}
