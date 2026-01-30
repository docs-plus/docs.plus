import { getPaginatedLastReadedNotifications,getUnreadNotificationsPaginated } from '@api'
import { useAuthStore,useStore } from '@stores'
import { TNotification, TTab } from '@types'
import { useCallback, useEffect, useRef, useState } from 'react'

const PAGE_SIZE = 10

interface UseInfiniteNotificationsResult {
  notifications: TNotification[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  sentinelRef: (node: HTMLDivElement | null) => void
}

/**
 * Hook for infinite scroll notifications.
 * Uses IntersectionObserver to trigger loading more when sentinel is visible.
 */
export const useInfiniteNotifications = (): UseInfiniteNotificationsResult => {
  const { workspaceId } = useStore((state) => state.settings)
  const user = useAuthStore((state) => state.profile)
  const {
    notifications,
    notificationActiveTab,
    setNotifications: _setNotifications,
    updateNotifications,
    setLoadingNotification,
    loadingNotification
  } = useStore((state) => state)

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Get current tab's notifications
  const currentNotifications = notifications.get(notificationActiveTab) || []

  // Reset pagination and fetch initial data when tab changes
  useEffect(() => {
    setPage(1)
    setHasMore(true)

    // For 'Read' tab, we need to fetch initial data since useNotificationSummary doesn't provide it
    const fetchInitialReadNotifications = async () => {
      if (notificationActiveTab !== 'Read') return
      if (!user?.id) return

      // Check if we already have data for this tab
      const existingData = notifications.get('Read')
      if (existingData && existingData.length > 0) return

      setLoadingNotification(true)
      try {
        const { data, error } = await getPaginatedLastReadedNotifications(
          user.id,
          workspaceId || '',
          1,
          PAGE_SIZE
        )

        if (error) {
          console.error('Error fetching read notifications:', error)
          return
        }

        if (data) {
          updateNotifications('Read', data as TNotification[])
          if (data.length < PAGE_SIZE) {
            setHasMore(false)
          }
        }
      } catch (error) {
        console.error('Error fetching read notifications:', error)
      } finally {
        setLoadingNotification(false)
      }
    }

    fetchInitialReadNotifications()
  }, [notificationActiveTab, user?.id, workspaceId])

  // Fetch notifications for a specific page
  const fetchNotifications = useCallback(
    async (pageNum: number, tab: TTab): Promise<TNotification[]> => {
      if (!user?.id) return []

      try {
        if (tab === 'Read') {
          const { data, error } = await getPaginatedLastReadedNotifications(
            user.id,
            workspaceId || '',
            pageNum,
            PAGE_SIZE
          )
          if (error) throw error
          return (data as TNotification[]) || []
        } else {
          const { data, error } = await getUnreadNotificationsPaginated({
            workspaceId,
            page: pageNum,
            size: PAGE_SIZE,
            type: tab === 'Unread' ? null : 'mention'
          })
          if (error) throw error
          return data || []
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
        return []
      }
    },
    [user?.id, workspaceId]
  )

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || loadingNotification) return

    setIsLoadingMore(true)

    try {
      const nextPage = page + 1
      const newNotifications = await fetchNotifications(nextPage, notificationActiveTab)

      if (newNotifications.length < PAGE_SIZE) {
        setHasMore(false)
      }

      if (newNotifications.length > 0) {
        // Append new notifications to existing ones
        const existingNotifications = notifications.get(notificationActiveTab) || []
        updateNotifications(notificationActiveTab, [...existingNotifications, ...newNotifications])
        setPage(nextPage)
      }
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    isLoadingMore,
    hasMore,
    loadingNotification,
    page,
    fetchNotifications,
    notificationActiveTab,
    notifications,
    updateNotifications
  ])

  // Sentinel ref callback for IntersectionObserver
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Disconnect existing observer
      if (observerRef.current) {
        observerRef.current.disconnect()
      }

      if (!node || !hasMore || isLoadingMore) return

      // Create new observer
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
            loadMore()
          }
        },
        {
          root: null,
          rootMargin: '100px',
          threshold: 0.1
        }
      )

      observerRef.current.observe(node)
    },
    [hasMore, isLoadingMore, loadMore]
  )

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return {
    notifications: currentNotifications,
    isLoading: loadingNotification,
    isLoadingMore,
    hasMore,
    loadMore,
    sentinelRef
  }
}
