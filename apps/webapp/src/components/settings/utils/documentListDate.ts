import type { DocumentSortKey, OwnedDocument } from '../types'
import { formatShortDate } from './formatShortDate'

export const documentListDate = (doc: OwnedDocument, sortKey: DocumentSortKey): string => {
  switch (sortKey) {
    case 'createdAt_desc':
      return formatShortDate(doc.createdAt)
    case 'lastOpenedAt_desc':
      return doc.lastOpenedAt ? formatShortDate(doc.lastOpenedAt) : 'Never opened'
    case 'updatedAt_desc':
    case 'title_asc':
    case 'title_desc':
      return formatShortDate(doc.updatedAt)
    default: {
      const _exhaustive: never = sortKey
      return _exhaustive
    }
  }
}
