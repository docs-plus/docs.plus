import type { StoreDocumentContext } from '../types'

/** Strict owner check for lifecycle actions (delete/restore/duplicate), for metadata
 *  writes, and for the Private/Read-only locks. Distinct from resolvePrivateAccess,
 *  which allows any signed-in caller on a non-private doc — here an ownerless or
 *  mismatched doc is never the caller's. */
export function isDocumentOwner(
  existing: { ownerId?: string | null } | null | undefined,
  requesterId?: string | null
): boolean {
  return requesterId != null && existing?.ownerId != null && existing.ownerId === requesterId
}

/** An ownerless document. Its title and description are open to everyone, signed
 *  in or not. Its locks cannot move — there is nobody for it to be private for. */
export function isOpenDocument(existing: { ownerId?: string | null } | null | undefined): boolean {
  return !existing?.ownerId
}

/** Who a first-edit create makes owner. Only a signed-in, non-anonymous user, because
 *  resolvePrivateAccess turns an anonymous owner away from their own Private document. */
export function firstEditOwner(user: StoreDocumentContext['user'] | null): {
  ownerId: string | null
  email: string | null
} {
  if (!user?.sub || user.is_anonymous === true) return { ownerId: null, email: null }
  return { ownerId: user.sub, email: user.email ?? null }
}
