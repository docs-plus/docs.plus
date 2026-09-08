/**
 * The rule deciding who may learn that a document changed. Its own module
 * because `contentChangeFanout.ts` imports `./prisma`, which builds a pool at
 * import and throws without DATABASE_URL, and this decision needs no database.
 */

/** Live document metadata the audience rule reads, and nothing more. */
export interface ContentChangeMetadata {
  deletedAt: Date | null
  isPrivate: boolean
  ownerId: string | null
}

export type ContentChangeAudience =
  | { kind: 'none'; reason: 'tombstoned' | 'private-no-owner' }
  | { kind: 'owner'; onlyUser: string }
  | { kind: 'all' }

/** A tombstone outranks ownership, so a trashed document reaches nobody. A purge
 *  leaves no metadata row at all, so it never reaches this rule. */
export function resolveContentChangeAudience(meta: ContentChangeMetadata): ContentChangeAudience {
  if (meta.deletedAt) return { kind: 'none', reason: 'tombstoned' }
  if (!meta.isPrivate) return { kind: 'all' }
  if (!meta.ownerId) return { kind: 'none', reason: 'private-no-owner' }
  return { kind: 'owner', onlyUser: meta.ownerId }
}
