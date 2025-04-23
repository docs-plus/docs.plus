import { getUnreadNotificationsPaginated, getPaginatedLastReadedNotifications } from '@api'
import { useStore, useAuthStore } from '@stores'
import { TNotification } from '@types'
import { useCallback, useEffect, useState } from 'react'

export const useLoadMoreNotifications = () => {
  const { workspaceId } = useStore((state) => state.settings)
  const user = useAuthStore((state) => state.profile)
  const [lastPage, setLastPage] = useState(false)
  const {
    setNotifications,
    notificationActiveTab,
    notificationPage,
    setNotificationPage,
    setLoadingNotification,
    loadingNotification
  } = useStore((state) => state)

  useEffect(() => {
    setNotificationPage(1)
    setLastPage(false)
  }, [notificationActiveTab])

  const loadMore = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
      if (loadingNotification) return
      setLoadingNotification(true)

      try {
        if (notificationActiveTab === 'Archived') {
          const { data, error } = await getPaginatedLastReadedNotifications(
            user?.id || '',
            notificationPage + 1,
            6
          )

          if (error) {
            console.error(error)
            return
          }

          if (!lastPage) setNotifications(notificationActiveTab, data as TNotification[])
          if (!lastPage) setNotificationPage(notificationPage + 1)
          if (data.length < 6) setLastPage(true)
        } else {
          const { data, error } = await getUnreadNotificationsPaginated({
            workspaceId,
            page: notificationPage + 1,
            size: 6,
            type: notificationActiveTab === 'All' ? null : 'mention'
          })

          if (error) {
            console.error(error)
            return
          }

          if (!lastPage) setNotifications(notificationActiveTab, data as TNotification[])
          if (!lastPage) setNotificationPage(notificationPage + 1)
          if (data.length < 6) setLastPage(true)
        }
      } catch (error) {
        console.error('Error loading more notifications:', error)
      } finally {
        setLoadingNotification(false)
      }
    },
    [workspaceId, user?.id, notificationPage, notificationActiveTab]
  )

  return {
    loadMore,
    lastPage
  }
}
