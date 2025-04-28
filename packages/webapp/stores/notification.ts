import { immer } from 'zustand/middleware/immer'
import { TNotification, TNotificationSummary, TTab } from '@types'

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
  clearNotificationSummary: () => void
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
      // get the notification for tab
      const notifications = state.notifications.get(tab) || []
      // add the new notifications
      state.notifications.set(tab, [...newNotifications, ...notifications])
    })
  },

  updateNotifications: (tab: TTab, newNotifications: TNotification[]) => {
    set((state) => {
      state.notifications.set(tab, newNotifications)
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

  clearNotificationSummary: () => {
    set((state) => {
      state.notificationSummary = {
        unread_count: 0,
        unread_mention_count: 0,
        last_unread: [],
        last_unread_mention: []
      }
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
