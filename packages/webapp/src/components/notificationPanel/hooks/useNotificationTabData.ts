import { useState, useEffect } from 'react'
import { useApi } from '@hooks/useApi'
import { getLastReadedNotification } from '@api'
import { useStore, useAuthStore } from '@stores'

interface UseNotificationTabDataProps {
  lastUnread: any[]
}

export const useNotificationTabData = () => {
  const { setNotifications, notificationActiveTab, setLoadingNotification } = useStore(
    (state) => state
  )
  const user = useAuthStore((state) => state.profile)
  const { workspaceId } = useStore((state) => state.settings)
  const { request: lastReadedRequest } = useApi(getLastReadedNotification, null, false)

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      setLoadingNotification(true)
      switch (notificationActiveTab) {
        case 'Unread':
          // setNotifications(lastUnread || [])
          // setNotifications('All', lastUnread)
          break
        case 'Mentions':
          // setNotifications(lastUnreadMention || [])
          // setNotifications('Mentions', lastUnread)
          break
        case 'Read':
          const { data: lastReadData } = await lastReadedRequest(user.id, workspaceId)
          // setNotifications(lastReadData || [])
          setNotifications('Read', lastReadData as any)
          break
        default:
          break
      }
      setLoadingNotification(false)
    }

    fetchNotifications()
  }, [notificationActiveTab])
}
