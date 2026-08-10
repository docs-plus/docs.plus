import type { AuthorRoster, AuthorRosterRow } from '@components/pages/history/types'
import type { ClientAuthorBinding } from '@types'

export const ANONYMOUS_KEY = 'anonymous'
export const UNRECORDED_KEY = 'unrecorded'

/**
 * Groups blocks by the people whose text sits in them. A block counts for every key
 * present in it, so per-person counts sum above `knownCount`. Two writers in one
 * paragraph is one block each, not half a block each.
 */
export const buildAuthorRoster = (
  blockClientIds: number[][],
  bindings: ClientAuthorBinding[]
): AuthorRoster => {
  const byClientId = new Map<number, ClientAuthorBinding>()
  for (const binding of bindings) byClientId.set(binding.clientId, binding)

  const blockIndicesByKey = new Map<string, number[]>()
  const blockKeys: string[][] = []
  const userIdByKey = new Map<string, string>()
  let knownCount = 0

  blockClientIds.forEach((clientIds, index) => {
    // A key claims a block once. One person's two clientIDs in the same block, or
    // two anonymous clients, must not push the index twice. The row would
    // double-count, and Previous/Next would stop on the block twice.
    const keys = new Set<string>()
    for (const clientId of clientIds) {
      const binding = byClientId.get(clientId)
      if (!binding) continue
      if (binding.isAnonymous) {
        keys.add(ANONYMOUS_KEY)
      } else {
        keys.add(binding.userId)
        userIdByKey.set(binding.userId, binding.userId)
      }
    }

    if (keys.size === 0) {
      blockKeys.push([])
      const indices = blockIndicesByKey.get(UNRECORDED_KEY) ?? []
      indices.push(index)
      blockIndicesByKey.set(UNRECORDED_KEY, indices)
      return
    }

    knownCount += 1
    blockKeys.push([...keys])
    for (const key of keys) {
      const indices = blockIndicesByKey.get(key) ?? []
      indices.push(index)
      blockIndicesByKey.set(key, indices)
    }
  })

  const userRows: AuthorRosterRow[] = []
  for (const [key, indices] of blockIndicesByKey) {
    if (key === ANONYMOUS_KEY || key === UNRECORDED_KEY) continue
    userRows.push({ key, kind: 'user', userId: userIdByKey.get(key), count: indices.length })
  }
  // Descending count, then userId, so row order does not move between renders.
  userRows.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))

  const rows = [...userRows]
  const anonymousCount = blockIndicesByKey.get(ANONYMOUS_KEY)?.length ?? 0
  if (anonymousCount > 0) {
    rows.push({ key: ANONYMOUS_KEY, kind: 'anonymous', count: anonymousCount })
  }
  const unrecordedCount = blockIndicesByKey.get(UNRECORDED_KEY)?.length ?? 0
  if (unrecordedCount > 0) {
    rows.push({ key: UNRECORDED_KEY, kind: 'unrecorded', count: unrecordedCount })
  }

  return { rows, blockIndicesByKey, blockKeys, knownCount, totalCount: blockClientIds.length }
}
