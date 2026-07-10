import type { DocumentSortKey } from './types'

// SAME 4-tuple the parent useInfiniteQuery keys on — a 3-tuple never matches the live
// query, so the optimistic patch would silently no-op under any non-default sort.
export const makeDocumentsKey = (uid: string, q: string, s: DocumentSortKey) =>
  ['documents', uid, q, s] as const

// Distinct prefix from makeDocumentsKey, so invalidating ['documents', uid] on
// restore refreshes the live list without touching the Trash view (and vice versa).
export const makeTrashKey = (uid: string) => ['documents-trash', uid] as const
