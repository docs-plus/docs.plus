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
