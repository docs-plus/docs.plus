import { useStore } from '@stores'
import { useEffect, useState } from 'react'

/**
 * Hook to get users currently present in a specific channel/heading
 */
export function usePresentUsers(channelId: string) {
  const usersPresence = useStore((state) => state.usersPresence)
  const [presentUsers, setPresentUsers] = useState<any[]>([])

  useEffect(() => {
    if (!usersPresence) return

    const users = Array.from(usersPresence.values()).filter(
      (user) => user?.channelId === channelId && user?.status !== 'OFFLINE'
    )

    setPresentUsers(users)
  }, [usersPresence, channelId])

  return presentUsers
}
