export interface IncomingId {
  /** The id the node arrived with, or wants back. */
  preferredId?: string | null
}

/**
 * For each incoming node in doc order: its preferred id if that id is free, else `null`
 * (the node takes a new id). An id is free when no node outside the incoming set holds
 * it and no earlier incoming node took it. Paste (#700) and file replace (#474) share it.
 */
export const keepPreferredIds = (
  incoming: readonly IncomingId[],
  liveElsewhere: ReadonlySet<string>
): (string | null)[] => {
  const taken = new Set(liveElsewhere)
  return incoming.map(({ preferredId }) => {
    if (!preferredId || taken.has(preferredId)) return null
    taken.add(preferredId)
    return preferredId
  })
}
