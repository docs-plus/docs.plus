export type PrivateAccess = 'allow' | 'sign-in-required' | 'denied'

/** Pure private-doc access decision shared by the WS gate and the REST slug read.
 *  Anonymous (no user or anon JWT) and ownerless-private hit the sign-in wall;
 *  a signed-in non-owner is denied; the owner (and any public doc) is allowed. */
export function resolvePrivateAccess(a: {
  isPrivate: boolean
  ownerId: string | null
  userId?: string | null
  isAnonymous?: boolean
}): PrivateAccess {
  if (!a.isPrivate) return 'allow'
  if (!a.userId || a.isAnonymous) return 'sign-in-required'
  if (!a.ownerId) return 'sign-in-required'
  return a.userId === a.ownerId ? 'allow' : 'denied'
}
