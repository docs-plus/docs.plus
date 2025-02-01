// @ts-nocheck
import { useEffect, useState } from 'react'
import { TabList } from '@components/ui/Tabs'
import {
  IoCheckmarkDoneSharp,
  IoChatboxOutline,
  IoMailOutline,
  IoChevronDownOutline
} from 'react-icons/io5'
import { BsReply, BsMegaphone } from 'react-icons/bs'
import { MdAlternateEmail, MdGroup } from 'react-icons/md'
import { AiOutlineAlert } from 'react-icons/ai'
import { useApi } from '@hooks/useApi'
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getLastReadedNotification,
  getNotificationsSummary,
  getUnreadNotificationsPaginated
} from '@api'
import { useAuthStore, useStore } from '@stores'
import { formatDistanceToNow } from 'date-fns'
import { Avatar } from '@components/ui/Avatar'
import React from 'react'
import { MdOutlineAllInbox } from 'react-icons/md'
import { MdMessage } from 'react-icons/md'
import { MdEmojiEmotions } from 'react-icons/md'

const getNotificationIcon = (type: string) => {
  const iconProps = { size: 16, className: 'text-gray-600 rounded-md size-5' }
  switch (type) {
    case 'mention':
      return (
        <span className="tooltip tooltip-right" data-tip="Mention">
          <MdAlternateEmail {...iconProps} />
        </span>
      )
    case 'message':
      return (
        <span className="tooltip tooltip-right" data-tip="Message">
          <MdMessage {...iconProps} />
        </span>
      )
    case 'reply':
      return (
        <span className="tooltip tooltip-right" data-tip="Reply">
          <BsReply {...iconProps} />
        </span>
      )
    case 'reaction':
      return (
        <span className="tooltip tooltip-right" data-tip="Reaction">
          <MdEmojiEmotions {...iconProps} />
        </span>
      )
    case 'thread_message':
      return (
        <span className="tooltip tooltip-right" data-tip="Thread Message">
          <IoChatboxOutline {...iconProps} />
        </span>
      )
    case 'channel_event':
      return (
        <span className="tooltip tooltip-right" data-tip="Channel Event">
          <BsMegaphone {...iconProps} />
        </span>
      )
    case 'direct_message':
      return (
        <span className="tooltip tooltip-right" data-tip="Direct Message">
          <IoMailOutline {...iconProps} />
        </span>
      )
    case 'invitation':
      return (
        <span className="tooltip tooltip-right" data-tip="Invitation">
          <MdGroup {...iconProps} />
        </span>
      )
    case 'system_alert':
      return (
        <span className="tooltip tooltip-right" data-tip="System Alert">
          <AiOutlineAlert {...iconProps} />
        </span>
      )
    default:
      return null
  }
}

const tabsDefault = [
  { label: 'All', count: 0 },
  { label: 'Mentions', count: 0 },
  { label: 'Archive' }
]

export const NotificationPanel = () => {
  const [activeTab, setActiveTab] = useState('All')
  const [notifications, setNotifications] = useState([])
  const [lastUnread, setLastUnread] = useState([])
  const [lastUnreadMention, setLastUnreadMention] = useState([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [unreadMentionCount, setUnreadMentionCount] = useState<number>(0)
  const { workspaceId } = useStore((state) => state.settings)
  const [tabs, setTabs] = useState<any>(tabsDefault)
  const [page, setPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const { metadata: docMetadata } = useStore((state) => state.settings)

  const user = useAuthStore((state) => state.profile)

  const { loading: summaryLoading, request: summaryRequest } = useApi(
    getNotificationsSummary,
    null,
    false
  )

  const { loading: lastReadedLoading, request: lastReadedRequest } = useApi(
    getLastReadedNotification,
    null,
    false
  )

  // Initialize notification summary data
  useEffect(() => {
    if (!user || !workspaceId) return

    const fetchNotificationSummary = async () => {
      try {
        const { data, error } = await summaryRequest({ workspaceId })
        if (error) throw error
        if (!data) throw new Error('No data returned from getNotificationsSummary')
        console.log({
          data
        })
        setLastUnread(data.last_unread || [])
        setLastUnreadMention(data.last_unread_mention || [])
        setUnreadCount(data.unread_count || 0)
        setUnreadMentionCount(data.unread_mention_count || 0)

        setNotifications(data.last_unread || [])
      } catch (error) {
        console.error('Error fetching notification summary:', error)
      }
    }

    fetchNotificationSummary()
  }, [user, workspaceId])

  useEffect(() => {
    setTabs([
      { label: 'All', count: unreadCount },
      { label: 'Mentions', count: unreadMentionCount },
      { label: 'Archive' }
    ])
  }, [unreadCount, unreadMentionCount])

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      switch (activeTab) {
        case 'All':
          // const { data: allData } = await allRequest(user.id)
          setNotifications(lastUnread || [])
          break
        case 'Mentions':
          // const { data: mentionData } = await mentionRequest(user.id)
          setNotifications(lastUnreadMention || [])
          break
        case 'Archive':
          const { data: lastReadData } = await lastReadedRequest(user.id)

          setNotifications(lastReadData || [])
          break
      }

      setPage(1)
    }

    fetchNotifications()
  }, [activeTab, user])

  const formatTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: false })
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const { data, error } = await markNotificationAsRead(notificationId)
      // Remove the notification from the list instead of updating its read status
      setNotifications(notifications.filter((notif) => notif.id !== notificationId))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return

    try {
      const { data, error } = await markAllNotificationsAsRead(user.id)
      // Clear all notifications from the state
      setNotifications([])
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const loadMoreNotifications = async () => {
    try {
      setIsLoadingMore(true)
      const { data, error } = await getUnreadNotificationsPaginated({
        workspaceId,
        page: page + 1,
        size: 6,
        type: activeTab === 'All' ? null : 'mention'
      })
      if (error) throw error

      setNotifications((prev) => [...prev, ...data])
      setPage((prev) => prev + 1)
    } catch (error) {
      console.error('Error loading more notifications:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className="min-w-96 p-3 pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Your Notifications </h1>
        <button
          onClick={handleMarkAllAsRead}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
          <span className="flex items-center gap-2 text-sm font-bold">
            <IoCheckmarkDoneSharp size={18} />
            Mark all as read
          </span>
        </button>
      </div>

      <div className="mt-4">
        <TabList className="" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="divider m-0 p-0"></div>
        <div className="max-h-96 overflow-y-auto">
          {/* <TabContent activeTab={activeTab} tabId="All"> */}
          {summaryLoading ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-8">
              <div className="loading loading-spinner loading-md"></div>
              <p className="text-sm text-gray-500">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-8">
              <div className="rounded-full bg-gray-100 p-3">
                <MdOutlineAllInbox size={24} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-gray-600">Your inbox is empty!</p>
                <p className="text-sm text-gray-500">
                  You're all caught up. New notifications will appear here.
                </p>
              </div>
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <div
                  className="my-2 flex items-start gap-4 rounded-lg border p-3 hover:bg-gray-50"
                  key={notification.id}>
                  {/* Avatar */}
                  <div className="h-10 w-10 flex-shrink-0">
                    <Avatar
                      id={notification.sender.id}
                      src={notification.sender.avatar_url}
                      avatarUpdatedAt={notification.sender.avatar_updated_at}
                      width={24}
                      height={24}
                      clickable={false}
                      className="h-[42px] min-h-[42px] w-[42px] cursor-pointer rounded-full border shadow-md"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col items-start gap-2">
                        <p className="flex flex-col items-start gap-1 text-sm font-bold">
                          <span className="flex items-center gap-1">
                            {getNotificationIcon(notification.type)}
                            <span className="font-semibold">
                              {notification.sender.display_name ||
                                notification.sender.full_name ||
                                notification.sender.username}
                            </span>
                          </span>

                          <span className="ml-6 text-xs text-gray-500">
                            {document.querySelector(
                              `.heading[data-id="${notification.channel_id}"] .title`
                            )?.textContent || docMetadata?.title}
                          </span>
                        </p>
                        <p className="rounded-md bg-gray-100 p-2 text-sm">
                          {notification.message_preview}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-1 flex items-center gap-2">
                      {/* <button className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
                        View
                      </button> */}

                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                      {activeTab !== 'Archive' && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="btn btn-ghost btn-sm ml-auto flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800">
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Load More button */}
              {((activeTab === 'All' && notifications.length < unreadCount) ||
                (activeTab === 'Mentions' && notifications.length < unreadMentionCount)) && (
                <div className="flex justify-center">
                  <button
                    onClick={loadMoreNotifications}
                    disabled={isLoadingMore}
                    className="btn btn-ghost btn-sm btn-block inline-flex items-center gap-2 rounded-md px-4 py-2">
                    {isLoadingMore ? (
                      <>
                        <div className="loading loading-spinner loading-xs"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More
                        <IoChevronDownOutline className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
          {/* </TabContent> */}

          {/* <TabContent activeTab={activeTab} tabId="Mentions">
            <div>Mentions content goes here</div>
          </TabContent>

          <TabContent activeTab={activeTab} tabId="Following">
            <div>Following content goes here</div>
          </TabContent>

          <TabContent activeTab={activeTab} tabId="Muted">
            <div>Muted content goes here</div>
          </TabContent> */}
        </div>
      </div>
    </div>
  )
}
