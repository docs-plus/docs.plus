import {
  getNotificationsSummary,
  getPaginatedLastReadNotifications,
  getUnreadNotificationsPaginated
} from '@api'
import { useApi } from '@hooks/useApi'
import { NOTIFICATION_STATE_CHANGED } from '@hooks/usePushNotifications'
import { useAuthStore, useStore } from '@stores'
import { type TNotification, type TNotificationSummary, type TTab } from '@types'
import PubSub from 'pubsub-js'
import { useCallback, useEffect, useRef, useState } from 'react'

const PAGE_SIZE = 10

type UseNotificationPanelFeedResult = {
  notifications: TNotification[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  sentinelRef: (node: HTMLDivElement | null) => void
}

async function fetchNotificationPage(
  tab: TTab,
  pageNum: number,
  userId: string,
  workspaceId: string | undefined
): Promise<TNotification[]> {
  if (tab === 'Read') {
    const { data, error } = await getPaginatedLastReadNotifications(
      userId,
      workspaceId || '',
      pageNum,
      PAGE_SIZE
    )
    if (error) throw error
    return (data as TNotification[]) || []
  }

  const { data, error } = await getUnreadNotificationsPaginated({
    workspaceId,
    page: pageNum,
    size: PAGE_SIZE,
    type: tab === 'Unread' ? null : 'mention'
  })
  if (error) throw error
  return data || []
}

export function useNotificationPanelFeed(): UseNotificationPanelFeedResult {
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const user = useAuthStore((state) => state.profile)
  const notifications = useStore((state) => state.notifications)
  const notificationActiveTab = useStore((state) => state.notificationActiveTab)
  const loadingNotification = useStore((state) => state.loadingNotification)
  const {
    setNotificationSummary,
    setNotifications,
    clearNotifications,
    setLoadingNotification,
    setNotificationTab,
    setNotificationPage,
    updateNotifications
  } = useStore((state) => state)
  const { request: summaryRequest } = useApi(getNotificationsSummary, null, false)

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const currentNotifications = notifications.get(notificationActiveTab) || []

  const refreshSummary = useCallback(async () => {
    if (!user || !workspaceId) return

    try {
      const { data, error } = await summaryRequest({ workspaceId })
      if (error) throw error
      if (!data) throw new Error('No data returned from getNotificationsSummary')

      const summaryData = Array.isArray(data) ? data[0] : data
      setNotificationSummary(summaryData as TNotificationSummary)
      setNotifications('Unread', summaryData.last_unread)
      setNotifications('Mentions', summaryData.last_unread_mention)
      setNotificationTab('Unread', summaryData.unread_count)
      setNotificationTab('Mentions', summaryData.unread_mention_count)
      setNotificationPage(1)
    } catch (error) {
      console.error('Error fetching notification feed:', error)
    } finally {
      setLoadingNotification(false)
    }
  }, [
    user,
    workspaceId,
    summaryRequest,
    setNotificationSummary,
    setNotifications,
    setNotificationTab,
    setNotificationPage,
    setLoadingNotification
  ])

  useEffect(() => {
    if (!user || !workspaceId) return
    setLoadingNotification(true)
    clearNotifications()
    refreshSummary()
  }, [user, workspaceId, clearNotifications, refreshSummary, setLoadingNotification])

  useEffect(() => {
    const token = PubSub.subscribe(NOTIFICATION_STATE_CHANGED, () => {
      refreshSummary()
    })
    return () => {
      PubSub.unsubscribe(token)
    }
  }, [refreshSummary])

  useEffect(() => {
    setPage(1)

    const loadInitialTabPage = async () => {
      if (notificationActiveTab !== 'Read') return
      if (!user?.id) return

      const existingData = useStore.getState().notifications.get('Read')
      if (existingData && existingData.length > 0) {
        setHasMore(existingData.length >= PAGE_SIZE)
        return
      }

      setLoadingNotification(true)
      try {
        const data = await fetchNotificationPage('Read', 1, user.id, workspaceId)
        updateNotifications('Read', data)
        setHasMore(data.length >= PAGE_SIZE)
      } catch (error) {
        console.error('Error fetching read notifications:', error)
      } finally {
        setLoadingNotification(false)
      }
    }

    if (notificationActiveTab === 'Read') {
      void loadInitialTabPage()
    } else {
      const count = (notifications.get(notificationActiveTab) || []).length
      setHasMore(count >= PAGE_SIZE)
    }
  }, [
    notificationActiveTab,
    user?.id,
    workspaceId,
    notifications,
    setLoadingNotification,
    updateNotifications
  ])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || loadingNotification || !user?.id) return

    setIsLoadingMore(true)

    try {
      const nextPage = page + 1
      const newNotifications = await fetchNotificationPage(
        notificationActiveTab,
        nextPage,
        user.id,
        workspaceId
      )

      if (newNotifications.length < PAGE_SIZE) {
        setHasMore(false)
      }

      if (newNotifications.length > 0) {
        const existingNotifications = notifications.get(notificationActiveTab) || []
        updateNotifications(notificationActiveTab, [...existingNotifications, ...newNotifications])
        setPage(nextPage)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    isLoadingMore,
    hasMore,
    loadingNotification,
    page,
    notificationActiveTab,
    notifications,
    updateNotifications,
    user?.id,
    workspaceId
  ])

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }

      if (!node || !hasMore || isLoadingMore) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
            loadMore()
          }
        },
        { root: null, rootMargin: '100px', threshold: 0.1 }
      )

      observerRef.current.observe(node)
    },
    [hasMore, isLoadingMore, loadMore]
  )

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return {
    notifications: currentNotifications,
    isLoading: loadingNotification,
    isLoadingMore,
    hasMore,
    sentinelRef
  }
}
