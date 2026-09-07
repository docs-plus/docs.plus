import type { HistoryItem } from '@types'

/**
 * A is the row older than the newest snapshot at or before `since`. That newer
 * row already holds the first persist that minted the notification, so using it
 * as A would hide that edit or no-op when it is also the head.
 */
export function pickCompareBaseSince(list: HistoryItem[], sinceIso: string): HistoryItem | null {
  const since = Date.parse(sinceIso)
  if (!Number.isFinite(since) || list.length < 2) return null

  // Newest-first, same order as `history.list`.
  const atOrBefore = list.findIndex((item) => Date.parse(item.createdAt) <= since)
  if (atOrBefore === -1) return list[list.length - 1] ?? null
  return list[atOrBefore + 1] ?? null
}
