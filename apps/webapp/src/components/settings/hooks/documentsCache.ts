import { hashKey, type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { makeTrashKey, ownerDocumentsPrefix } from '../documentsQueryKey'
import type { OwnedDocument } from '../types'
import {
  insertDocumentAtSlot,
  type Pages,
  patchDocumentInPages,
  removeDocumentFromPages,
  removeDocumentsFromPages,
  setFavoriteInPages
} from '../utils/documentsPageCache'

/** Puts every list back exactly as it stood before one optimistic write. */
export type Rollback = () => void

export type RemovedDocument = {
  removed: OwnedDocument
  rollback: Rollback
  /** Undo: splice the row back at its slot in whatever the list holds now, not in the
   *  snapshot. The person can search, sort or load more inside the Undo window. */
  reinsert: () => void
}

/**
 * The patch-versus-invalidate rule lives here. A remove or an in-place patch keeps the
 * loaded rows equal to a server prefix, so it patches. An insert of a row whose server
 * position this list cannot know refetches instead, and never patches.
 */
export interface DocumentsCache {
  removeDocument(documentId: string): Promise<RemovedDocument | null>
  removeDocuments(documentIds: string[]): Promise<Rollback | null>
  patchDocument(documentId: string, fields: Partial<OwnedDocument>): Promise<Rollback | null>
  setFavorite(documentId: string, isFavorite: boolean): Promise<Rollback | null>
  /** The copy's place is the server's to decide, so this only marks the list stale. */
  addDuplicate(): void
}

/**
 * Writes every list under `prefix`: one per scope, search and sort. Owned and All share
 * rows, so a write to one list alone would leave the other stale. A remove or a patch keeps each
 * list a server prefix, so no list refetches and none can race the pending write.
 * Keyed on the hash: a caller builds a fresh key array every render.
 */
function useDocumentPagesCache(prefix: QueryKey): DocumentsCache {
  const queryClient = useQueryClient()
  const prefixHash = hashKey(prefix)

  return useMemo(() => {
    const filter = { queryKey: prefix }
    const readAll = () =>
      queryClient
        .getQueriesData<Pages>(filter)
        .filter((entry): entry is [QueryKey, Pages] => entry[1] !== undefined)
    const restore =
      (snapshots: [QueryKey, Pages][]): Rollback =>
      () =>
        snapshots.forEach(([key, pages]) => queryClient.setQueryData(key, pages))

    // Cancel first: a refetch already in flight lands after the patch and reverts it.
    // Only a list that holds rows: cancelling a first fetch (Home's next pick) reverts it
    // to idle with no data, and it never fetches again.
    const cancelLoaded = () =>
      queryClient.cancelQueries({ ...filter, predicate: (q) => q.state.data !== undefined })
    const edit = async (change: (pages: Pages) => Pages): Promise<Rollback | null> => {
      await cancelLoaded()
      const snapshots = readAll()
      if (snapshots.length === 0) return null
      for (const [key, pages] of snapshots) queryClient.setQueryData(key, change(pages))
      return restore(snapshots)
    }

    return {
      async removeDocument(documentId) {
        await cancelLoaded()
        const snapshots = readAll()
        const outcomes = snapshots.flatMap(([key, pages]) => {
          const outcome = removeDocumentFromPages(pages, documentId)
          return outcome ? [{ key, ...outcome }] : []
        })
        if (outcomes.length === 0) return null
        for (const { key, pages } of outcomes) queryClient.setQueryData(key, pages)
        return {
          removed: outcomes[0].removed,
          rollback: restore(snapshots),
          // Each list puts the row back at its own slot.
          reinsert: () => {
            for (const { key, removed, slot } of outcomes) {
              const live = queryClient.getQueryData<Pages>(key)
              if (live) queryClient.setQueryData(key, insertDocumentAtSlot(live, removed, slot))
            }
          }
        }
      },
      removeDocuments: (documentIds) =>
        edit((pages) => removeDocumentsFromPages(pages, documentIds)),
      patchDocument: (documentId, fields) =>
        edit((pages) => patchDocumentInPages(pages, documentId, fields)),
      setFavorite: (documentId, isFavorite) =>
        edit((pages) => setFavoriteInPages(pages, documentId, isFavorite)),
      addDuplicate() {
        // Refetch, never patch. A copy has no `lastOpenedAt`, so under `lastOpenedAt_desc`
        // the server sorts it last, past the loaded window. A patch put it near the top and
        // the refetch then removed it, so the row flashed and vanished.
        queryClient.invalidateQueries(filter)
      }
    }
    // `prefix` is left out on purpose: the hash above is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, prefixHash])
}

export const useOwnerDocumentsCache = (userId: string): DocumentsCache =>
  useDocumentPagesCache(ownerDocumentsPrefix(userId))

export interface TrashCache extends DocumentsCache {
  /** Refetch Trash when only the server knows the result: Empty trash purges pages this
   *  list never loaded, and a soft delete or restore from the live list moves a row into or
   *  out of Trash at a place this list cannot know. */
  resync(): Promise<void>
  /** A restore moves a row out of Trash and into the Owner live list, which never saw it. */
  resyncOwnerList(): void
}

export function useTrashCache(userId: string): TrashCache {
  const queryClient = useQueryClient()
  const pages = useDocumentPagesCache(makeTrashKey(userId))

  return useMemo(
    () => ({
      ...pages,
      resync: () => queryClient.invalidateQueries({ queryKey: makeTrashKey(userId) }),
      resyncOwnerList: () => {
        queryClient.invalidateQueries({ queryKey: ownerDocumentsPrefix(userId) })
      }
    }),
    [pages, queryClient, userId]
  )
}
