import { useEffect } from 'react'
import { useApi } from '@hooks/useApi'
import { getNotificationsSummary } from '@api'
import { useAuthStore, useStore } from '@stores'
import { TNotificationSummary } from '@types'
import { useDropdown } from '@components/ui/Dropdown'
import { useModalBottomToTopOptional } from '@components/ui'

export const useNotificationSummary = ({ mobile = false }: { mobile: boolean }) => {
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
  const modalContext = mobile ? useModalBottomToTopOptional() : null
  const dropdownContext = mobile ? null : useDropdown()
  const isOpen = modalContext?.isOpen || dropdownContext?.isOpen || false

  const { request: summaryRequest } = useApi(getNotificationsSummary, null, false)

  useEffect(() => {
    if (!user || !workspaceId) return
    setLoadingNotification(true)
    clearNotifications()

    const fetchNotificationSummary = async () => {
      try {
        const { data, error } = await summaryRequest({ workspaceId })

        if (error) throw error
        if (!data) throw new Error('No data returned from getNotificationsSummary')

        if (!data) {
          console.error('No data returned from getNotificationsSummary')
          return
        }

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
    }

    fetchNotificationSummary()
  }, [user, workspaceId, isOpen])
}
