import { resolvePrivateAccess } from './privateAccess'

export type WsAccess = 'allow' | 'deny'

/** Pure WS access decision — no I/O. Soft-deleted and uncertain lookups deny
 *  (fail closed); private policy is shared with REST via `resolvePrivateAccess`. */
export function resolveWsAccess(a: {
  isPrivate: boolean
  ownerId: string | null
  user: { sub?: string; is_anonymous?: boolean } | null
  lookupFailed: boolean
  /** True for a soft delete and for a purge tombstone: both must deny, so the store
   *  worker and a stale client mirror cannot resurrect the document. */
  deleted: boolean
}): WsAccess {
  if (a.lookupFailed || a.deleted) return 'deny'
  return resolvePrivateAccess({
    isPrivate: a.isPrivate,
    ownerId: a.ownerId,
    userId: a.user?.sub,
    isAnonymous: a.user?.is_anonymous
  }) === 'allow'
    ? 'allow'
    : 'deny'
}
