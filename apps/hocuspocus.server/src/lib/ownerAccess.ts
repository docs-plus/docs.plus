/** Strict owner check for privileged lifecycle actions (delete/restore/duplicate).
 *  Distinct from resolvePrivateAccess, which allows any signed-in caller on a
 *  non-private doc — here an ownerless or mismatched doc is never the caller's. */
export function isDocumentOwner(
  existing: { ownerId?: string | null } | null | undefined,
  requesterId?: string | null
): boolean {
  return requesterId != null && existing?.ownerId != null && existing.ownerId === requesterId
}

/** May change Private/Read-only: owner, or any authed caller claiming an ownerless doc. */
export function canMutateAccessFlags(
  existing: { ownerId?: string | null } | null | undefined,
  requesterId?: string | null
): boolean {
  return requesterId != null && (!existing?.ownerId || existing.ownerId === requesterId)
}
