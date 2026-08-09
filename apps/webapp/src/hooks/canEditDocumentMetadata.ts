import type { Workspace } from '@stores'

/**
 * Who may write title, description and keywords. An owned document answers only to
 * its owner; an ownerless one is open to everyone, signed in or not. The backend
 * enforces the same rule — `PUT /api/documents/:docId` 403s a non-owner on an owned
 * row — so this exists to keep the affordance off screen, not as the control.
 */
export const canEditDocumentMetadata = (settings: Workspace, profileId?: string): boolean => {
  // The store seeds `metadata` with an undefined documentId and fills it after the
  // fetch, so a missing ownerId reads the same as an open document while the layout
  // is still pre-sync. Answering true there flashes an editable title on a document
  // the caller cannot rename, so wait for documentId before deciding.
  if (settings.metadata?.documentId == null) return false

  const ownerId = settings.metadata.ownerId
  return ownerId == null || ownerId === profileId
}
