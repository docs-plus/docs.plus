import { useMemo } from 'react'
import { useStore } from '@stores'

/**
 * Hook to get users currently viewing a heading section.
 */
const usePresentUsers = (headingId: string) => {
  const usersPresence = useStore((state) => state.usersPresence)

  const presentUsers = useMemo(() => {
    if (!usersPresence || !headingId) return []

    return Array.from(usersPresence.values()).filter(
      (user) => user?.channelId === headingId && user?.status !== 'OFFLINE'
    )
  }, [usersPresence, headingId])

  return presentUsers
}

export default usePresentUsers
