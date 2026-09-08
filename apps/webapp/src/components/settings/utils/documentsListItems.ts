import type { DocumentSortKey, OwnedDocument } from '../types'
import {
  DOCUMENT_TIME_BUCKET_LABEL,
  documentTimeBucket,
  isDateSortKey,
  timestampForSort
} from './documentTimeBucket'

export type DocumentsListItem =
  | { kind: 'hairline' }
  | { kind: 'bucket'; label: string; key: string }
  | { kind: 'doc'; doc: OwnedDocument; index: number }

/**
 * Favorites sit first and stay unbucketed, so the hairline closes that block and the Date
 * buckets start again after it. `index` is the flat row number the roving tabindex counts.
 */
export function buildDocumentsListItems(
  docs: OwnedDocument[],
  sortKey: DocumentSortKey
): DocumentsListItem[] {
  const dateSort = isDateSortKey(sortKey)
  const items: DocumentsListItem[] = []
  let lastBucket: string | null = null

  docs.forEach((doc, index) => {
    const prev = index > 0 ? docs[index - 1] : undefined
    const inFavoriteBlock = !!doc.isFavorite
    if (prev?.isFavorite && !doc.isFavorite) {
      items.push({ kind: 'hairline' })
      lastBucket = null
    }
    if (dateSort && !inFavoriteBlock) {
      const bucket = documentTimeBucket(timestampForSort(doc, sortKey))
      if (bucket !== lastBucket) {
        items.push({
          kind: 'bucket',
          label: DOCUMENT_TIME_BUCKET_LABEL[bucket],
          key: `${bucket}-${index}`
        })
        lastBucket = bucket
      }
    }
    items.push({ kind: 'doc', doc, index })
  })
  return items
}
