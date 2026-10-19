/** The metadata fields the owner rule reads. `DocumentMetadata` builds on them. */
export type DocumentOwnerFields = {
  documentId?: string | null
  ownerId?: string | null
}

/**
 * The server's strict owner rule (`lib/ownerAccess.ts`), plus one client rule. The store
 * seeds metadata without a documentId and fills it after the fetch, so no answer here
 * says yes before documentId lands. Otherwise owner or open controls flash on a stranger.
 */
export const isDocumentOwner = (
  metadata: DocumentOwnerFields | undefined,
  profileId?: string | null
): boolean => metadata?.documentId != null && !!profileId && metadata.ownerId === profileId

/** Title, description and keywords. An empty ownerId is a persist leftover, so it is open.
 *  The PUT 403s everyone else; this keeps the control off screen. */
export const canEditDocumentMetadata = (
  metadata: DocumentOwnerFields | undefined,
  profileId?: string | null
): boolean =>
  metadata?.documentId != null && (!metadata.ownerId || isDocumentOwner(metadata, profileId))
