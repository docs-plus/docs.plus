import type { TGroupedMsgRow, TMsgRow } from '@types'
import { isSameDay, parseISO } from 'date-fns'

const isDifferentDay = (a: string, b: string): boolean => !isSameDay(parseISO(a), parseISO(b))

const compareByTimeThenId = (a: TMsgRow, b: TMsgRow): number => {
  const ta = Date.parse(a.created_at)
  const tb = Date.parse(b.created_at)
  if (ta !== tb) return ta - tb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Pure projection of raw rows to grouping-flagged rows.
 * Sorts by `(created_at ASC, id ASC)` so realtime/pagination races
 * project deterministically. Never mutates the input.
 */
export const projectMessageGroups = (
  rows: ReadonlyArray<TMsgRow>,
  currentUserId: string | null | undefined
): TGroupedMsgRow[] => {
  if (rows.length === 0) return []

  const sorted = [...rows].sort(compareByTimeThenId)

  return sorted.map((message, index) => {
    const prev = index > 0 ? sorted[index - 1] : undefined
    const next = index < sorted.length - 1 ? sorted[index + 1] : undefined

    // Notifications are standalone bubbles: they break the group on both
    // sides and mark themselves as a one-row group.
    const isGroupStart =
      !prev ||
      message.user_id !== prev.user_id ||
      prev.type === 'notification' ||
      message.type === 'notification' ||
      isDifferentDay(message.created_at, prev.created_at)

    const isGroupEnd =
      !next ||
      message.user_id !== next.user_id ||
      next.type === 'notification' ||
      message.type === 'notification' ||
      isDifferentDay(message.created_at, next.created_at)

    return {
      ...message,
      isGroupStart,
      isGroupEnd,
      isNewGroupById: !prev || message.user_id !== prev.user_id,
      isOwner: !!currentUserId && message.user_id === currentUserId
    }
  })
}
