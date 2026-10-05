import type { OwnedDocument } from '../types'

/** An empty title falls back to the slug, so no surface shows a blank name. */
export const documentDisplayName = (doc: Pick<OwnedDocument, 'title' | 'slug'>): string =>
  doc.title || doc.slug
