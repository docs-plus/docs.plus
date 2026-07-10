import { formatShortDate } from './formatShortDate'

// Mirrors the backend reaper's DOC_DELETE_RETENTION_DAYS (worker env, default 30).
// Drives only the Trash countdown copy — the server stays the source of truth for
// when a document is actually purged.
export const DOC_DELETE_RETENTION_DAYS = 30

const MS_PER_DAY = 86_400_000

// Whole days until permanent removal, clamped at 0; null for an unparseable date.
export const retentionDaysLeft = (
  deletedAtIso: string,
  retentionDays = DOC_DELETE_RETENTION_DAYS
): number | null => {
  const deletedAt = new Date(deletedAtIso).getTime()
  if (Number.isNaN(deletedAt)) return null
  const elapsedDays = (Date.now() - deletedAt) / MS_PER_DAY
  return Math.max(0, Math.ceil(retentionDays - elapsedDays))
}

export interface RetentionCountdown {
  days: number
  text: string
  /** 3 days or fewer left — render in the warning ink. */
  warn: boolean
}

// "27 days left" / "Last day" / "Removing soon", with a warn flag for the tail.
export const retentionCountdown = (deletedAtIso: string): RetentionCountdown | null => {
  const days = retentionDaysLeft(deletedAtIso)
  if (days === null) return null
  const text = days <= 0 ? 'Removing soon' : days === 1 ? 'Last day' : `${days} days left`
  return { days, text, warn: days <= 3 }
}

// Relative "Deleted X ago" for a trash row; falls back to an absolute date past the
// retention window (a row that outlived the reaper — shouldn't happen, but safe).
export const formatDeletedAgo = (deletedAtIso: string): string => {
  const then = new Date(deletedAtIso).getTime()
  if (Number.isNaN(then)) return 'Deleted'

  const mins = Math.max(0, (Date.now() - then) / 60_000)
  if (mins < 1) return 'Deleted just now'
  if (mins < 60) {
    const n = Math.floor(mins)
    return `Deleted ${n} minute${n === 1 ? '' : 's'} ago`
  }
  const hrs = mins / 60
  if (hrs < 24) {
    const n = Math.floor(hrs)
    return `Deleted ${n} hour${n === 1 ? '' : 's'} ago`
  }
  const days = hrs / 24
  if (days < DOC_DELETE_RETENTION_DAYS) {
    const n = Math.floor(days)
    return `Deleted ${n} day${n === 1 ? '' : 's'} ago`
  }
  return `Deleted ${formatShortDate(deletedAtIso)}`
}
