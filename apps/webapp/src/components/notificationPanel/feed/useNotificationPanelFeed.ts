import {
  getNotificationsSummary,
  getPaginatedLastReadNotifications,
  getUnreadNotificationsPaginated
} from '@api'
import { useApi } from '@hooks/useApi'
import { usePanelFeedSentinel } from '@hooks/usePanelFeedSentinel'
import { NOTIFICATION_STATE_CHANGED } from '@services/eventsHub'
import { useAuthStore, useStore } from '@stores'
import { type TNotification, type TNotificationSummary, type TTab } from '@types'
import PubSub from 'pubsub-js'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 10

type UseNotificationPanelFeedResult = {
  notifications: TNotification[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  /** The active tab's first load failed; the panel shows an error state, not the empty one. */
  isError: boolean
  /** Reloads the active tab's first page. */
  retry: () => void
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
  const setNotificationSummary = useStore((state) => state.setNotificationSummary)
  const setNotifications = useStore((state) => state.setNotifications)
  const clearNotifications = useStore((state) => state.clearNotifications)
  const setLoadingNotification = useStore((state) => state.setLoadingNotification)
  const setNotificationTab = useStore((state) => state.setNotificationTab)
  const setNotificationPage = useStore((state) => state.setNotificationPage)
  const updateNotifications = useStore((state) => state.updateNotifications)
  const { request: summaryRequest } = useApi(getNotificationsSummary, null, false)

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // Unread and Mentions load through the summary; Read loads its own first page.
  const [summaryFailed, setSummaryFailed] = useState(false)
  const [readFailed, setReadFailed] = useState(false)

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
      setSummaryFailed(false)
    } catch (error) {
      console.error('Error fetching notification feed:', error)
      setSummaryFailed(true)
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

  const loadReadFirstPage = useCallback(async () => {
    if (!user?.id) return

    setLoadingNotification(true)
    try {
      const data = await fetchNotificationPage('Read', 1, user.id, workspaceId)
      updateNotifications('Read', data)
      setHasMore(data.length >= PAGE_SIZE)
      setReadFailed(false)
    } catch (error) {
      console.error('Error fetching read notifications:', error)
      setReadFailed(true)
    } finally {
      setLoadingNotification(false)
    }
  }, [user?.id, workspaceId, setLoadingNotification, updateNotifications])

  useEffect(() => {
    setPage(1)

    if (notificationActiveTab === 'Read') {
      const existingData = useStore.getState().notifications.get('Read')
      if (existingData && existingData.length > 0) {
        setHasMore(existingData.length >= PAGE_SIZE)
        return
      }
      void loadReadFirstPage()
    } else {
      // One-shot seed on tab change; loadMore owns hasMore from here via its own
      // setHasMore(false), so this must not re-run on every notifications Map write.
      const count = (useStore.getState().notifications.get(notificationActiveTab) || []).length
      setHasMore(count >= PAGE_SIZE)
    }
  }, [notificationActiveTab, loadReadFirstPage])

  const retry = useCallback(() => {
    if (notificationActiveTab === 'Read') {
      void loadReadFirstPage()
      return
    }
    setLoadingNotification(true)
    void refreshSummary()
  }, [notificationActiveTab, loadReadFirstPage, refreshSummary, setLoadingNotification])

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

  const sentinelRef = usePanelFeedSentinel({ hasMore, isLoadingMore, loadMore })

  return {
    notifications: currentNotifications,
    isLoading: loadingNotification,
    isLoadingMore,
    hasMore,
    isError: notificationActiveTab === 'Read' ? readFailed : summaryFailed,
    retry,
    sentinelRef
  }
}
