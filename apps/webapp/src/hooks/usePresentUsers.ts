import { selectPresenceOthers } from '@services/workspacePresenceSync'
import { useAuthStore, useStore } from '@stores'
import type { Profile as TProfile } from '@types'
import { useShallow } from 'zustand/react/shallow'

// Module-level cache keyed by the usersPresence Map identity. Builds the
// per-channel index ONCE per presence event instead of O(N) inside every
// TOC item's selector. Cache entry is GC'd with the Map.
const byChannelCache = new WeakMap<Map<string, TProfile>, Map<string, TProfile[]>>()

const getByChannel = (usersPresence: Map<string, TProfile>) => {
  let by = byChannelCache.get(usersPresence)
  if (by) return by
  by = new Map<string, TProfile[]>()
  for (const user of usersPresence.values()) {
    const channelId = user.channelId
    if (!channelId) continue
    if (user.status === 'OFFLINE') continue
    const arr = by.get(channelId)
    if (arr) arr.push(user)
    else by.set(channelId, [user])
  }
  byChannelCache.set(usersPresence, by)
  return by
}

const EMPTY: TProfile[] = []

/** Users present in a heading channel (excludes self — authed track() adds self to the map). */
export function usePresentUsers(channelId: string) {
  const profileId = useAuthStore((state) => state.profile?.id)

  return useStore(
    useShallow((state) => {
      if (!channelId || !state.usersPresence) return EMPTY
      const list = getByChannel(state.usersPresence).get(channelId) ?? EMPTY
      if (!list.length) return EMPTY
      if (!profileId) return list
      const others = selectPresenceOthers(list, profileId)
      return others.length === 0 ? EMPTY : others
    })
  )
}
