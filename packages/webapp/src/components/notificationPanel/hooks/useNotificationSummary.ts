import { getNotificationsSummary } from '@api'
import { useApi } from '@hooks/useApi'
import { NOTIFICATION_STATE_CHANGED } from '@hooks/usePushNotifications'
import { useAuthStore, useStore } from '@stores'
import { TNotificationSummary } from '@types'
import PubSub from 'pubsub-js'
import { useCallback, useEffect } from 'react'

export const useNotificationSummary = () => {
  const { workspaceId } = useStore((state) => state.settings)
  const user = useAuthStore((state) => state.profile)
  const {
    setNotificationSummary,
    setNotifications,
    clearNotifications,
    setLoadingNotification,
    setNotificationTab,
    setNotificationPage
  } = useStore((state) => state)

  const { request: summaryRequest } = useApi(getNotificationsSummary, null, false)

  const fetchNotificationSummary = useCallback(async () => {
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
      console.error('Error fetching notification summary:', error)
    } finally {
      setLoadingNotification(false)
    }
  }, [user, workspaceId, summaryRequest])

  // Initial fetch on mount
  useEffect(() => {
    if (!user || !workspaceId) return
    setLoadingNotification(true)
    clearNotifications()
    fetchNotificationSummary()
  }, [user, workspaceId])

  // Listen for notification state changes (from push clicks, etc.)
  useEffect(() => {
    const token = PubSub.subscribe(NOTIFICATION_STATE_CHANGED, () => {
      // Refresh notification summary when a notification is marked as read via push
      fetchNotificationSummary()
    })

    return () => {
      PubSub.unsubscribe(token)
    }
  }, [fetchNotificationSummary])
}
