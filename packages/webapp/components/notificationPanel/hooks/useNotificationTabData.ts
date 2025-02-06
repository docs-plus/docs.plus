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

  const { request: lastReadedRequest } = useApi(getLastReadedNotification, null, false)

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      setLoadingNotification(true)
      switch (notificationActiveTab) {
        case 'All':
          // setNotifications(lastUnread || [])
          // setNotifications('All', lastUnread)
          break
        case 'Mentions':
          // setNotifications(lastUnreadMention || [])
          // setNotifications('Mentions', lastUnread)
          break
        case 'Archived':
          const { data: lastReadData } = await lastReadedRequest(user.id)
          // setNotifications(lastReadData || [])
          setNotifications('Archived', lastReadData as any)
          break
        default:
          break
      }
      setLoadingNotification(false)
    }

    fetchNotifications()
  }, [notificationActiveTab])
}
