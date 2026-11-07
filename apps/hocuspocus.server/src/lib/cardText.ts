// Words and dates the social card and the link card both write. UTC, so every replica agrees.

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
] as const

/** "Oct 31", or "Oct 31, 2025" outside `now`'s year. */
export const shortDate = (date: Date, now: Date): string => {
  const day = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
  return date.getUTCFullYear() === now.getUTCFullYear() ? day : `${day}, ${date.getUTCFullYear()}`
}

/** "28 Oct 2026", a UTC day: one value for every viewer, so one `cardVersion`. */
export const cardDate = (date: Date): string =>
  `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`

/** The one plural rule for card text. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** Exported because `chatRead.ts` caps the stored count at it, so no card shows more. */
export const COUNT_CAP = 10

/** The one count rule for values that grow: 1 to 9 exact, then "10+". Null for 0. */
export const countBucket = (n: number): string | null => {
  if (!Number.isFinite(n) || n <= 0) return null
  return n >= COUNT_CAP ? `${COUNT_CAP}+` : String(Math.floor(n))
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

/** The one grapheme split for stored lines and for the card fit. */
export const graphemesOf = (text: string): string[] =>
  Array.from(segmenter.segment(text), (part) => part.segment)

/**
 * "15", "12.4k": how many people joined, as a number only. Null below 3, so a near-empty pad
 * shows no count. Thousands round down, so it never claims more people than joined.
 */
export const peopleCount = (n: number | null): string | null => {
  if (n === null || n < 3) return null
  return n < 1000 ? String(n) : `${Math.floor(n / 100) / 10}k`
}

/** "15 people joined", the drawn people row; null below 3. */
export const peopleLabel = (n: number | null): string | null => {
  const count = peopleCount(n)
  return count ? `${count} people joined` : null
}
