import { useState, useEffect } from 'react'
import { getUnreadNotificationCount } from '@api'

interface UseNotificationCountProps {
  workspaceId?: string | null
  intervalMs?: number
}

export const useNotificationCount = ({
  workspaceId,
  intervalMs = 15000
}: UseNotificationCountProps) => {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchNotificationCount = async () => {
      const count = await getUnreadNotificationCount({
        workspace_id: workspaceId || null
      })
      setUnreadCount(count)
    }

    fetchNotificationCount()

    const intervalId = setInterval(fetchNotificationCount, intervalMs)

    return () => clearInterval(intervalId)
  }, [workspaceId, intervalMs])

  return unreadCount
}
