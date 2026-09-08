import type { DocumentSortKey } from './types'

/** The three facts that pick one Owner live list. One value, so the surfaces that patch
 *  that list cannot rebuild a key from loose parts and miss the live query. */
export type DocumentsListScope = {
  userId: string
  searchQuery: string
  sortKey: DocumentSortKey
}

// SAME 4-tuple the parent useInfiniteQuery keys on — a 3-tuple never matches the live
// query, so the optimistic patch would silently no-op under any non-default sort.
export const makeDocumentsKey = ({ userId, searchQuery, sortKey }: DocumentsListScope) =>
  ['documents', userId, searchQuery, sortKey] as const

/** Every Owner live list one owner holds, across search terms and sort keys. */
export const ownerDocumentsPrefix = (uid: string) => ['documents', uid] as const

// Distinct prefix from makeDocumentsKey, so invalidating ['documents', uid] on
// restore refreshes the live list without touching the Trash view (and vice versa).
export const makeTrashKey = (uid: string) => ['documents-trash', uid] as const
