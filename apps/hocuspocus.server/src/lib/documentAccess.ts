import { resolvePrivateAccess } from './privateAccess'

export type DocumentAccess = 'allow' | 'not-found' | 'sign-in-required' | 'denied' | 'read-only'

export interface DocumentAccessMeta {
  isPrivate: boolean
  readOnly: boolean
  ownerId: string | null
  deletedAt: Date | null
}

/**
 * One reason per surface: REST maps it to a status, MCP to a tool error.
 * Service role is not an input; each caller lets it pass before asking.
 */
export function decideDocumentAccess(
  meta: DocumentAccessMeta | null,
  caller: { userId?: string | null; isAnonymous?: boolean },
  want: 'read' | 'write'
): DocumentAccess {
  if (!meta || meta.deletedAt) return 'not-found'
  const access = resolvePrivateAccess({
    isPrivate: meta.isPrivate,
    ownerId: meta.ownerId,
    userId: caller.userId,
    isAnonymous: caller.isAnonymous
  })
  if (access !== 'allow') return access
  if (want === 'write' && meta.readOnly && caller.userId !== meta.ownerId) return 'read-only'
  return 'allow'
}
