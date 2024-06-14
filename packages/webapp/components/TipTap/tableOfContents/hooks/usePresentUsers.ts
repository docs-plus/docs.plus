import { useEffect, useState } from 'react'
import { useStore } from '@stores'

const usePresentUsers = (item: any) => {
  const usersPresence = useStore((state) => state.usersPresence)
  const [presentUsers, setPresentUsers] = useState([])

  useEffect(() => {
    if (!usersPresence) return
    const precenseUsers = usersPresence.values()
    const users = Array.from(precenseUsers)
      .filter((user) => user?.channelId === item.id)
      .filter((user) => user?.status !== 'OFFLINE') as any

    setPresentUsers(users)
  }, [usersPresence])

  return presentUsers
}

export default usePresentUsers
