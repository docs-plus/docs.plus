import { resolvePrivateAccess } from './privateAccess'

export type WsAccess = 'allow' | 'deny'

/** Pure WS access decision — no I/O. `lookupFailed` means privacy could not be
 *  determined, so deny (fail closed); a successful public-doc lookup still allows.
 *  Private policy is shared with the REST slug read via `resolvePrivateAccess`. */
export function resolveWsAccess(a: {
  isPrivate: boolean
  ownerId: string | null
  user: { sub?: string; is_anonymous?: boolean } | null
  lookupFailed: boolean
}): WsAccess {
  if (a.lookupFailed) return 'deny'
  return resolvePrivateAccess({
    isPrivate: a.isPrivate,
    ownerId: a.ownerId,
    userId: a.user?.sub,
    isAnonymous: a.user?.is_anonymous
  }) === 'allow'
    ? 'allow'
    : 'deny'
}
