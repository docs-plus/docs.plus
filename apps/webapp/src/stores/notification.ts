import { TNotification, TNotificationSummary, TTab } from '@types'
import { immer } from 'zustand/middleware/immer'

type TNotificationTab = {
  label: TTab
  count?: number
}

interface INotificationStore {
  notificationSummary: TNotificationSummary
  totalNotificationUnreadCount: number
  notificationTabs: TNotificationTab[]
  loadingNotification: boolean
  notifications: Map<TTab, TNotification[]>
  notificationActiveTab: TTab
  notificationPage: number
  setNotificationSummary: (summary: TNotificationSummary) => void
  setNotifications: (tab: TTab, notifications: TNotification[]) => void
  setNotificationTab: (tab: TTab, count?: number) => void
  setLoadingNotification: (loading: boolean) => void
  setTotalNotificationUnreadCount: (count: number) => void
  setNotificationActiveTab: (tab: TTab) => void
  setNotificationPage: (page: number) => void
  clearNotifications: () => void
  emptyNotifications: () => void
  updateNotifications: (tab: TTab, newNotifications: TNotification[]) => void
  decrementNotificationCounts: (notification: TNotification) => void
  removeNotificationById: (notificationId: string) => void
}

const notification = immer<INotificationStore>((set) => ({
  notificationSummary: {
    unread_count: 0,
    unread_mention_count: 0,
    last_unread: [],
    last_unread_mention: []
  },
  notifications: new Map<TTab, TNotification[]>(),
  notificationTabs: [
    { label: 'Unread', count: 0 },
    { label: 'Mentions', count: 0 },
    { label: 'Read' }
  ],
  totalNotificationUnreadCount: 0,
  loadingNotification: false,
  notificationActiveTab: 'Unread',
  notificationPage: 1,

  setTotalNotificationUnreadCount: (count: number) => {
    set((state) => {
      state.totalNotificationUnreadCount = count
    })
  },

  setLoadingNotification: (loading: boolean) => {
    set((state) => {
      state.loadingNotification = loading
    })
  },

  setNotificationTab: (tab: TTab, count?: number) => {
    set((state) => {
      state.notificationTabs = state.notificationTabs.map((item) => {
        if (item.label === tab) return { ...item, count }
        return item
      })
    })
  },

  setNotificationSummary: (summary: TNotificationSummary) => {
    set((state) => {
      state.notificationSummary = summary
    })
  },

  setNotifications: (tab: TTab, newNotifications: TNotification[]) => {
    set((state) => {
      state.notifications.set(tab, newNotifications)
    })
  },

  updateNotifications: (tab: TTab, newNotifications: TNotification[]) => {
    set((state) => {
      state.notifications.set(tab, newNotifications)
    })
  },

  decrementNotificationCounts: (notification: TNotification) => {
    set((state) => {
      state.totalNotificationUnreadCount = Math.max(0, state.totalNotificationUnreadCount - 1)
      state.notificationTabs = state.notificationTabs.map((item) => {
        if (item.label === 'Unread' && item.count != null && item.count > 0) {
          return { ...item, count: item.count - 1 }
        }
        if (
          item.label === 'Mentions' &&
          notification.type === 'mention' &&
          item.count != null &&
          item.count > 0
        ) {
          return { ...item, count: item.count - 1 }
        }
        return item
      })
    })
  },

  removeNotificationById: (notificationId: string) => {
    set((state) => {
      for (const tab of state.notifications.keys()) {
        const list = state.notifications.get(tab)
        if (!list?.some((item) => item.id === notificationId)) continue
        state.notifications.set(
          tab,
          list.filter((item) => item.id !== notificationId)
        )
      }
    })
  },

  emptyNotifications: () => {
    set((state) => {
      state.notifications.clear()
    })
  },

  setNotificationActiveTab: (tab: TTab) => {
    set((state) => {
      state.notificationActiveTab = tab
    })
  },

  setNotificationPage: (page: number) => {
    set((state) => {
      state.notificationPage = page
    })
  },

  clearNotifications: () => {
    set((state) => {
      state.notifications.clear()
      state.notificationSummary = {
        unread_count: 0,
        unread_mention_count: 0,
        last_unread: [],
        last_unread_mention: []
      }
      state.notificationTabs = state.notificationTabs.map((item) => ({
        ...item,
        count: 0
      }))
    })
  }
}))

export default notification
