import type { HistoryItem } from '@types'

/**
 * Why A can be missing, told apart. `unchanged` and `baseline-pruned` both mean
 * "A is the head", and only the second one means the document moved.
 */
export type CompareBaseSince =
  | { kind: 'base'; item: HistoryItem }
  | { kind: 'unchanged' }
  | { kind: 'baseline-pruned' }
  | { kind: 'unavailable' }

/**
 * A is the newest snapshot at or before `since`, the instant the reader left.
 * Scanned, never indexed: `history.list` is `version desc` while this predicate
 * reads `createdAt`, and one out-of-order commit makes the two orders disagree.
 * Ties break on the higher version, mirroring the server's `resolveAnchor`.
 */
export function pickCompareBaseSince(list: HistoryItem[], sinceIso: string): CompareBaseSince {
  const since = Date.parse(sinceIso)
  if (!Number.isFinite(since) || list.length === 0) return { kind: 'unavailable' }

  // Indexed, not scanned: `history.list` ships `version desc`, and every other
  // reader of the list takes index 0 as the head.
  const head = list[0]
  let base: HistoryItem | null = null
  let baseAt = 0
  let oldest: HistoryItem | null = null
  let oldestAt = 0
  let savedSinceLeft = false

  for (const item of list) {
    const at = Date.parse(item.createdAt)
    if (!Number.isFinite(at)) continue

    if (at > since) savedSinceLeft = true

    // This end searches backwards, so its tie breaks on the LOWER version. Same
    // rule as A, read along the other direction: prefer the row further back.
    if (!oldest || at < oldestAt || (at === oldestAt && item.version < oldest.version)) {
      oldest = item
      oldestAt = at
    }

    if (at <= since && (!base || at > baseAt || (at === baseAt && item.version > base.version))) {
      base = item
      baseAt = at
    }
  }

  // The reader left before the oldest retained row, so retention has taken the
  // real baseline and the oldest survivor is the closest honest A.
  const chosen = base ?? oldest
  if (!chosen) return { kind: 'unavailable' }
  if (chosen.version !== head.version) return { kind: 'base', item: chosen }

  return savedSinceLeft ? { kind: 'baseline-pruned' } : { kind: 'unchanged' }
}

/** Copy for the two arms that carry no A. Null means the caller stays quiet. */
export function compareBaseSinceMessage(result: CompareBaseSince): string | null {
  if (result.kind === 'unchanged') return 'Nothing changed since you left.'
  if (result.kind === 'baseline-pruned') return 'No earlier version to compare against.'
  // An empty list or a broken instant is not a fact about the document, and
  // neither frozen message states one. Say nothing.
  return null
}
