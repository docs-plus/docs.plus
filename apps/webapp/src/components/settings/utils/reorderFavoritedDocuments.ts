import type { InfiniteData } from '@tanstack/react-query'

import type { DocumentsPage, OwnedDocument } from '../types'

function reorderFavoritedDocuments(docs: OwnedDocument[]): OwnedDocument[] {
  return [...docs.filter((d) => d.isFavorite), ...docs.filter((d) => !d.isFavorite)]
}

/** Writes a flat list back into the loaded page sizes. A surplus grows page 0. */
function replacePageDocs(
  data: InfiniteData<DocumentsPage>,
  docs: OwnedDocument[]
): InfiniteData<DocumentsPage> {
  const loaded = data.pages.reduce((n, page) => n + page.docs.length, 0)
  const surplus = Math.max(0, docs.length - loaded)
  let offset = 0
  return {
    ...data,
    pages: data.pages.map((page, i) => {
      const take = page.docs.length + (i === 0 ? surplus : 0)
      const slice = docs.slice(offset, offset + take)
      offset += take
      return { ...page, total: page.total + surplus, docs: slice }
    })
  }
}

export function patchFavoriteInPages(
  data: InfiniteData<DocumentsPage>,
  documentId: string,
  isFavorite: boolean
): InfiniteData<DocumentsPage> {
  const flat = data.pages.flatMap((page) =>
    page.docs.map((d) => (d.documentId === documentId ? { ...d, isFavorite } : d))
  )
  return replacePageDocs(data, reorderFavoritedDocuments(flat))
}

export function insertAfterFavoritesInPages(
  data: InfiniteData<DocumentsPage>,
  created: OwnedDocument
): InfiniteData<DocumentsPage> {
  const flat = data.pages.flatMap((page) => page.docs)
  const lastFav = flat.findLastIndex((d) => d.isFavorite)
  const next =
    lastFav === -1
      ? [created, ...flat]
      : [...flat.slice(0, lastFav + 1), created, ...flat.slice(lastFav + 1)]
  return replacePageDocs(data, next)
}
