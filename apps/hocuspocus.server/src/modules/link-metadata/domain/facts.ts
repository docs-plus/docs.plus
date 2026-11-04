import { shortDate } from '../../../lib/cardText'

/** A date string from page or API JSON, written by `shortDate`. Undefined when it does not parse. */
export const factDate = (value: unknown, now: Date): string | undefined => {
  if (typeof value !== 'string' || value.length > 64) return undefined
  const time = Date.parse(value)
  return Number.isNaN(time) ? undefined : shortDate(new Date(time), now)
}

/** 999 → "999", 12_345 → "12.3k", 999_950 → "1M". */
export const compactCount = (value: number): string => {
  if (value < 1000) return String(value)
  for (const [size, unit] of [
    [1e3, 'k'],
    [1e6, 'M'],
    [1e9, 'B']
  ] as const) {
    const scaled = Math.round((value / size) * 10) / 10
    if (scaled < 1000 || unit === 'B') return `${scaled}${unit}`
  }
  return String(value)
}
