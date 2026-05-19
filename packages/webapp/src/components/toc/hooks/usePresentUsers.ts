import { useAuthStore, useStore } from '@stores'
import { useMemo } from 'react'

/**
 * Users present in a heading channel (excludes self — authed track() adds self to the map).
 */
export function usePresentUsers(channelId: string) {
  const usersPresence = useStore((state) => state.usersPresence)
  const profileId = useAuthStore((state) => state.profile?.id)

  return useMemo(() => {
    if (!usersPresence || !channelId) return []

    return Array.from(usersPresence.values()).filter(
      (user) =>
        user?.channelId === channelId && user?.status !== 'OFFLINE' && user?.id !== profileId
    )
  }, [usersPresence, channelId, profileId])
}
