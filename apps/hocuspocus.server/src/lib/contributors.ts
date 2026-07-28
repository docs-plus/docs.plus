import type { StoreDocumentContext } from '../types'

// Keyed by the live Document, so the set is collected with the room and a room
// that never persists cannot leak it. Ids accumulate between saves; the store
// hook drains them onto the version row it is about to enqueue.
const contributorsByDocument = new WeakMap<object, Set<string>>()

/**
 * Never throws: it runs inside the un-awaited onChange hook chain, where a
 * rejection surfaces as an unhandled rejection instead of a handled error.
 */
export const recordContributor = (
  document: object | null | undefined,
  context: StoreDocumentContext | null | undefined
): void => {
  const sub = context?.user?.sub
  if (!document || !sub) return

  const ids = contributorsByDocument.get(document)
  if (ids) {
    ids.add(sub)
    return
  }
  contributorsByDocument.set(document, new Set([sub]))
}

export const drainContributors = (document: object | null | undefined): string[] => {
  const ids = document ? contributorsByDocument.get(document) : undefined
  if (!ids || ids.size === 0) return []

  const drained = [...ids]
  ids.clear()
  return drained
}
