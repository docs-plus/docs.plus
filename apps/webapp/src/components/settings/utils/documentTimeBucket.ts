import type { DocumentSortKey } from '../types'

export type DocumentTimeBucket = 'today' | 'yesterday' | 'week' | 'month' | 'earlier' | 'never'

type DateSortKey = Extract<
  DocumentSortKey,
  'updatedAt_desc' | 'createdAt_desc' | 'lastOpenedAt_desc'
>

export const DOCUMENT_TIME_BUCKET_LABEL: Record<DocumentTimeBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Previous 7 days',
  month: 'Previous 30 days',
  earlier: 'Earlier',
  never: 'Never opened'
}

const DAY_MS = 86_400_000

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

export const documentTimeBucket = (
  iso: string | null | undefined,
  now = new Date()
): DocumentTimeBucket => {
  if (!iso) return 'never'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 'never'

  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return 'week'
  if (days < 30) return 'month'
  return 'earlier'
}

export const isDateSortKey = (sortKey: DocumentSortKey): sortKey is DateSortKey =>
  sortKey === 'updatedAt_desc' || sortKey === 'createdAt_desc' || sortKey === 'lastOpenedAt_desc'

export const timestampForSort = (
  doc: { updatedAt: string; createdAt: string; lastOpenedAt?: string | null },
  sortKey: DateSortKey
): string | null => {
  switch (sortKey) {
    case 'updatedAt_desc':
      return doc.updatedAt
    case 'createdAt_desc':
      return doc.createdAt
    case 'lastOpenedAt_desc':
      return doc.lastOpenedAt ?? null
    default: {
      const _exhaustive: never = sortKey
      return _exhaustive
    }
  }
}
