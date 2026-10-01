import type { DocumentsScope } from './constants'
import type { DocumentSortKey } from './types'

/** The facts that pick one documents list. One value, so the surfaces that patch that
 *  list cannot rebuild a key from loose parts and miss the live query. */
export type DocumentsListScope = {
  userId: string
  scope: DocumentsScope
  searchQuery: string
  sortKey: DocumentSortKey
}

// The key carries every scope field. A key that drops one never matches the live query,
// so the optimistic patch would silently no-op under that scope, search or sort.
export const makeDocumentsKey = ({ userId, scope, searchQuery, sortKey }: DocumentsListScope) =>
  ['documents', userId, scope, searchQuery, sortKey] as const

/** Every documents list one user holds, across scopes, search terms and sort keys. */
export const ownerDocumentsPrefix = (uid: string) => ['documents', uid] as const

// Distinct prefix from makeDocumentsKey, so invalidating ['documents', uid] on
// restore refreshes the live list without touching the Trash view (and vice versa).
export const makeTrashKey = (uid: string) => ['documents-trash', uid] as const
