import type { InfiniteData } from '@tanstack/react-query'

import type { DocumentsPage, OwnedDocument } from '../types'

/** The infinite-query shape both Owner lists hold. Declared once, imported by the hook. */
export type Pages = InfiniteData<DocumentsPage>

/** Where a row sat before it was removed, so Undo can put it back in the same place. */
export type DocumentSlot = { pageIndex: number; indexInPage: number }

export type RemovalOutcome = { pages: Pages; removed: OwnedDocument; slot: DocumentSlot }

/**
 * The offset Load more must ask for: the rows already held, never a page index times a page
 * size. A page index cannot see an optimistic remove, so it re-asks for an offset the server
 * list has already shifted past, and one document disappears until a reload. Both the Owner
 * live list and Trash page this way. A remove is safe; an insert is not, so a copy refetches.
 */
export function nextDocumentsOffset(pages: DocumentsPage[], total: number): number | undefined {
  const loaded = countLoaded(pages)
  return loaded < total ? loaded : undefined
}

const countLoaded = (pages: DocumentsPage[]) => pages.reduce((n, page) => n + page.docs.length, 0)

/**
 * Writes a reordered list back into the loaded page sizes. Reorder only: its one caller
 * passes a length-preserving permutation, so no page grows and no total moves.
 */
function writeDocumentsIntoPages(data: Pages, docs: OwnedDocument[]): Pages {
  let offset = 0
  return {
    ...data,
    pages: data.pages.map((page) => {
      const slice = docs.slice(offset, offset + page.docs.length)
      offset += page.docs.length
      return { ...page, docs: slice }
    })
  }
}

/**
 * `total` is one global count replicated on every page, and it alone decides hasNextPage.
 * Decrement every page by the count removed across ALL pages, never by the per-page count,
 * which would make the pages disagree.
 */
export function removeDocumentsFromPages(data: Pages, documentIds: string[]): Pages {
  const ids = new Set(documentIds)
  const removedCount = data.pages.reduce(
    (n, page) => n + page.docs.filter((d) => ids.has(d.documentId)).length,
    0
  )
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      total: Math.max(0, page.total - removedCount),
      docs: page.docs.filter((d) => !ids.has(d.documentId))
    }))
  }
}

/** Null when the list never held the row, so a caller can skip the write and the Undo banner. */
export function removeDocumentFromPages(data: Pages, documentId: string): RemovalOutcome | null {
  let removed: OwnedDocument | undefined
  let slot: DocumentSlot = { pageIndex: 0, indexInPage: 0 }
  data.pages.forEach((page, pageIndex) => {
    const indexInPage = page.docs.findIndex((d) => d.documentId === documentId)
    if (indexInPage !== -1) {
      removed = page.docs[indexInPage]
      slot = { pageIndex, indexInPage }
    }
  })
  if (!removed) return null
  return { pages: removeDocumentsFromPages(data, [documentId]), removed, slot }
}

export function insertDocumentAtSlot(data: Pages, doc: OwnedDocument, slot: DocumentSlot): Pages {
  return {
    ...data,
    pages: data.pages.map((page, pageIndex) => ({
      ...page,
      total: page.total + 1,
      docs:
        pageIndex === slot.pageIndex
          ? [...page.docs.slice(0, slot.indexInPage), doc, ...page.docs.slice(slot.indexInPage)]
          : page.docs
    }))
  }
}

export function patchDocumentInPages(
  data: Pages,
  documentId: string,
  fields: Partial<OwnedDocument>
): Pages {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      docs: page.docs.map((d) => (d.documentId === documentId ? { ...d, ...fields } : d))
    }))
  }
}

const favoritesFirst = (docs: OwnedDocument[]): OwnedDocument[] => [
  ...docs.filter((d) => d.isFavorite),
  ...docs.filter((d) => !d.isFavorite)
]

/** Favorite pins a row to the top of the Owner live list, so the mark also moves the row. */
export function setFavoriteInPages(data: Pages, documentId: string, isFavorite: boolean): Pages {
  const patched = patchDocumentInPages(data, documentId, { isFavorite })
  return writeDocumentsIntoPages(data, favoritesFirst(patched.pages.flatMap((p) => p.docs)))
}
