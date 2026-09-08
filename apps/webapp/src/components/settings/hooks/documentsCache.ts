import { hashKey, type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  type DocumentsListScope,
  makeDocumentsKey,
  makeTrashKey,
  ownerDocumentsPrefix
} from '../documentsQueryKey'
import type { OwnedDocument } from '../types'
import {
  insertDocumentAtSlot,
  type Pages,
  patchDocumentInPages,
  removeDocumentFromPages,
  removeDocumentsFromPages,
  setFavoriteInPages
} from '../utils/documentsPageCache'

/** Puts the list back exactly as it stood before one optimistic write. */
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
 * Keyed on the hash, not the array: a caller builds a fresh key array every render, and an
 * identity dependency would rebuild every method and break the memo of every consumer.
 */
function useDocumentPagesCache(key: QueryKey): DocumentsCache {
  const queryClient = useQueryClient()
  const keyHash = hashKey(key)

  return useMemo(() => {
    const read = () => queryClient.getQueryData<Pages>(key)
    const write = (pages: Pages) => queryClient.setQueryData(key, pages)

    // Cancel first: a refetch already in flight lands after the patch and reverts it.
    const edit = async (change: (pages: Pages) => Pages): Promise<Rollback | null> => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = read()
      if (!snapshot) return null
      write(change(snapshot))
      return () => write(snapshot)
    }

    return {
      async removeDocument(documentId) {
        await queryClient.cancelQueries({ queryKey: key })
        const snapshot = read()
        if (!snapshot) return null
        const outcome = removeDocumentFromPages(snapshot, documentId)
        if (!outcome) return null
        write(outcome.pages)
        return {
          removed: outcome.removed,
          rollback: () => write(snapshot),
          reinsert: () => {
            const live = read()
            if (live) write(insertDocumentAtSlot(live, outcome.removed, outcome.slot))
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
        queryClient.invalidateQueries({ queryKey: key })
      }
    }
    // `key` is left out on purpose: the hash above is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, keyHash])
}

export const useOwnerDocumentsCache = (scope: DocumentsListScope): DocumentsCache =>
  useDocumentPagesCache(makeDocumentsKey(scope))

export interface TrashCache extends DocumentsCache {
  /** Empty trash purges pages this list never loaded, so only the server knows the new
   *  total. Every other Trash write is a removal, which the paging rule lets us patch. */
  resync(): void
  /** A restore moves a row out of Trash and into the Owner live list, which never saw it. */
  resyncOwnerList(): void
}

export function useTrashCache(userId: string): TrashCache {
  const queryClient = useQueryClient()
  const pages = useDocumentPagesCache(makeTrashKey(userId))

  return useMemo(
    () => ({
      ...pages,
      resync: () => {
        queryClient.invalidateQueries({ queryKey: makeTrashKey(userId) })
      },
      resyncOwnerList: () => {
        queryClient.invalidateQueries({ queryKey: ownerDocumentsPrefix(userId) })
      }
    }),
    [pages, queryClient, userId]
  )
}
