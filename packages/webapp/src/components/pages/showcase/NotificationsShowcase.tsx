/**
 * NotificationsShowcase Component
 * ================================
 * Showcase page for Notifications and Bookmarks management.
 */

import { useState } from 'react'
import Head from 'next/head'
import {
  MdNotifications,
  MdBookmark,
  MdBookmarkBorder,
  MdComment,
  MdPerson,
  MdEdit,
  MdShare,
  MdDelete,
  MdCheck,
  MdClose,
  MdMoreVert,
  MdFilterList,
  MdDoneAll,
  MdNotificationsOff,
  MdDescription,
  MdAccessTime,
  MdStar,
  MdStarBorder,
  MdFolder,
  MdLabel,
  MdSearch,
  MdArrowForward
} from 'react-icons/md'
import { Avatar } from '@components/ui'
import { ShowcaseLayout } from './layouts'

type TabType = 'notifications' | 'bookmarks'
type NotificationFilter = 'all' | 'unread' | 'mentions' | 'comments'

interface Notification {
  id: string
  type: 'mention' | 'comment' | 'share' | 'edit' | 'system'
  title: string
  description: string
  time: string
  read: boolean
  user?: {
    id: string
    name: string
  }
  document?: string
}

interface Bookmark {
  id: string
  title: string
  document: string
  excerpt: string
  createdAt: string
  starred: boolean
  labels: string[]
}

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'mention',
    title: 'Sarah mentioned you',
    description: 'in "Q4 Product Roadmap" — @you can you review the timeline section?',
    time: '5 min ago',
    read: false,
    user: { id: 'user-1', name: 'Sarah Miller' },
    document: 'Q4 Product Roadmap'
  },
  {
    id: '2',
    type: 'comment',
    title: 'New comment on your document',
    description: 'Alex replied to your comment in "Design System Guidelines"',
    time: '1 hour ago',
    read: false,
    user: { id: 'user-2', name: 'Alex Chen' },
    document: 'Design System Guidelines'
  },
  {
    id: '3',
    type: 'share',
    title: 'Document shared with you',
    description: 'Jordan shared "Engineering Specs v2.1" with you',
    time: '2 hours ago',
    read: true,
    user: { id: 'user-3', name: 'Jordan Lee' },
    document: 'Engineering Specs v2.1'
  },
  {
    id: '4',
    type: 'edit',
    title: 'Document edited',
    description: 'Casey made changes to "Team Meeting Notes" that you bookmarked',
    time: '3 hours ago',
    read: true,
    user: { id: 'user-4', name: 'Casey Brown' },
    document: 'Team Meeting Notes'
  },
  {
    id: '5',
    type: 'system',
    title: 'Weekly digest ready',
    description:
      'Your activity summary for this week is available. 12 documents edited, 5 comments.',
    time: 'Yesterday',
    read: true
  },
  {
    id: '6',
    type: 'mention',
    title: 'Sarah mentioned you',
    description: 'in "Feature Specs" — @you the API section needs your input',
    time: '2 days ago',
    read: true,
    user: { id: 'user-1', name: 'Sarah Miller' },
    document: 'Feature Specs'
  }
]

const DEMO_BOOKMARKS: Bookmark[] = [
  {
    id: '1',
    title: 'API Authentication Section',
    document: 'Engineering Specs v2.1',
    excerpt: 'All API requests must include a valid JWT token in the Authorization header...',
    createdAt: 'Today',
    starred: true,
    labels: ['Important', 'Tech']
  },
  {
    id: '2',
    title: 'Q4 Goals Overview',
    document: 'Q4 Product Roadmap',
    excerpt: 'Our primary objectives for Q4 include improving collaboration features and...',
    createdAt: 'Yesterday',
    starred: true,
    labels: ['Review']
  },
  {
    id: '3',
    title: 'Color System',
    document: 'Design System Guidelines',
    excerpt: 'The color system is designed to be minimal, cohesive, and user-friendly...',
    createdAt: '3 days ago',
    starred: false,
    labels: ['Design']
  },
  {
    id: '4',
    title: 'Decision: Database Migration',
    document: 'Team Meeting Notes',
    excerpt: 'After discussing options, we decided to proceed with PostgreSQL migration...',
    createdAt: '1 week ago',
    starred: false,
    labels: ['Decision']
  },
  {
    id: '5',
    title: 'User Research Findings',
    document: 'UX Research Report',
    excerpt: 'Key insight: 78% of users prefer the compact view for document navigation...',
    createdAt: '2 weeks ago',
    starred: false,
    labels: ['Research', 'UX']
  }
]

const LABEL_COLORS: Record<string, string> = {
  Important: 'badge-error',
  Tech: 'badge-info',
  Review: 'badge-warning',
  Design: 'badge-secondary',
  Decision: 'badge-primary',
  Research: 'badge-accent',
  UX: 'badge-success'
}

export const NotificationsShowcase = () => {
  const [activeTab, setActiveTab] = useState<TabType>('notifications')
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS)
  const [bookmarks, setBookmarks] = useState(DEMO_BOOKMARKS)
  const [searchQuery, setSearchQuery] = useState('')

  const unreadCount = notifications.filter((n) => !n.read).length

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read
    if (filter === 'mentions') return n.type === 'mention'
    if (filter === 'comments') return n.type === 'comment'
    return true
  })

  const filteredBookmarks = bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.document.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })))
  }

  const toggleBookmarkStar = (id: string) => {
    setBookmarks(bookmarks.map((b) => (b.id === id ? { ...b, starred: !b.starred } : b)))
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'mention':
        return { icon: MdPerson, color: 'text-primary', bg: 'bg-primary/10' }
      case 'comment':
        return { icon: MdComment, color: 'text-info', bg: 'bg-info/10' }
      case 'share':
        return { icon: MdShare, color: 'text-secondary', bg: 'bg-secondary/10' }
      case 'edit':
        return { icon: MdEdit, color: 'text-warning', bg: 'bg-warning/10' }
      case 'system':
        return { icon: MdNotifications, color: 'text-base-content/60', bg: 'bg-base-200' }
      default:
        return { icon: MdNotifications, color: 'text-base-content/60', bg: 'bg-base-200' }
    }
  }

  return (
    <>
      <Head>
        <title>Notifications & Bookmarks | docs.plus Showcase</title>
      </Head>
      <ShowcaseLayout
        title="Notifications & Bookmarks"
        description="Stay updated on activity and save important sections for quick access.">
        {/* Tabs */}
        <div className="mb-8 flex items-center gap-4">
          <div role="tablist" className="tabs tabs-boxed bg-base-200 p-1">
            <button
              role="tab"
              className={`tab gap-2 ${activeTab === 'notifications' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('notifications')}>
              <MdNotifications size={18} />
              Notifications
              {unreadCount > 0 && (
                <span className="badge badge-primary badge-sm">{unreadCount}</span>
              )}
            </button>
            <button
              role="tab"
              className={`tab gap-2 ${activeTab === 'bookmarks' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('bookmarks')}>
              <MdBookmark size={18} />
              Bookmarks
              <span className="badge badge-ghost badge-sm">{bookmarks.length}</span>
            </button>
          </div>
        </div>

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {(['all', 'unread', 'mentions', 'comments'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === 'unread' && unreadCount > 0 && (
                      <span className="badge badge-sm">{unreadCount}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className="btn btn-ghost btn-sm gap-1">
                  <MdDoneAll size={16} />
                  Mark all read
                </button>
                <button className="btn btn-ghost btn-sm gap-1">
                  <MdNotificationsOff size={16} />
                  Settings
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="divide-base-300 divide-y">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="bg-base-200 mb-4 flex size-16 items-center justify-center rounded-full">
                      <MdNotifications size={32} className="text-base-content/40" />
                    </div>
                    <h3 className="text-lg font-semibold">No notifications</h3>
                    <p className="text-base-content/60 text-sm">
                      {filter === 'all'
                        ? "You're all caught up!"
                        : `No ${filter} notifications found.`}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notification) => {
                    const iconData = getNotificationIcon(notification.type)
                    return (
                      <div
                        key={notification.id}
                        className={`group hover:bg-base-200/50 flex items-start gap-4 p-4 transition-colors ${
                          !notification.read ? 'bg-primary/5' : ''
                        }`}>
                        {/* Icon or Avatar */}
                        {notification.user ? (
                          <Avatar id={notification.user.id} size="md" clickable={false} />
                        ) : (
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconData.bg}`}>
                            <iconData.icon size={20} className={iconData.color} />
                          </div>
                        )}

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p
                                className={`font-medium ${!notification.read ? '' : 'text-base-content/80'}`}>
                                {notification.title}
                              </p>
                              <p className="text-base-content/60 mt-0.5 text-sm">
                                {notification.description}
                              </p>
                            </div>
                            {!notification.read && (
                              <span className="bg-primary mt-2 size-2 shrink-0 rounded-full" />
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-base-content/50 flex items-center gap-1 text-xs">
                              <MdAccessTime size={12} />
                              {notification.time}
                            </span>
                            {notification.document && (
                              <span className="text-base-content/50 flex items-center gap-1 text-xs">
                                <MdDescription size={12} />
                                {notification.document}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {notification.document && (
                            <button
                              className="btn btn-ghost btn-xs btn-circle"
                              title="Open document">
                              <MdArrowForward size={16} />
                            </button>
                          )}
                          <button className="btn btn-ghost btn-xs btn-circle" title="Mark as read">
                            <MdCheck size={16} />
                          </button>
                          <button className="btn btn-ghost btn-xs btn-circle" title="Delete">
                            <MdClose size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bookmarks Tab */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 sm:max-w-xs">
                <MdSearch
                  size={20}
                  className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                />
                <input
                  type="text"
                  placeholder="Search bookmarks..."
                  className="input input-bordered w-full pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost btn-sm gap-1">
                  <MdFilterList size={16} />
                  Filter
                </button>
                <button className="btn btn-ghost btn-sm gap-1">
                  <MdFolder size={16} />
                  Folders
                </button>
              </div>
            </div>

            {/* Starred Section */}
            {filteredBookmarks.some((b) => b.starred) && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <MdStar size={18} className="text-warning" />
                  <h3 className="font-semibold">Starred</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredBookmarks
                    .filter((b) => b.starred)
                    .map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className="card border-base-300 bg-base-100 group border transition-all hover:shadow-md">
                        <div className="card-body p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate font-medium">{bookmark.title}</h4>
                              <p className="text-base-content/60 mt-0.5 flex items-center gap-1 text-xs">
                                <MdDescription size={12} />
                                {bookmark.document}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleBookmarkStar(bookmark.id)}
                              className="btn btn-ghost btn-xs btn-circle text-warning">
                              <MdStar size={18} />
                            </button>
                          </div>
                          <p className="text-base-content/70 mt-2 line-clamp-2 text-sm">
                            {bookmark.excerpt}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1">
                            {bookmark.labels.map((label) => (
                              <span
                                key={label}
                                className={`badge badge-sm ${LABEL_COLORS[label] || 'badge-ghost'}`}>
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* All Bookmarks */}
            <div>
              {filteredBookmarks.some((b) => b.starred) && (
                <div className="mb-3 flex items-center gap-2">
                  <MdBookmark size={18} className="text-primary" />
                  <h3 className="font-semibold">All Bookmarks</h3>
                </div>
              )}
              <div className="card border-base-300 bg-base-100 border">
                <div className="divide-base-300 divide-y">
                  {filteredBookmarks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="bg-base-200 mb-4 flex size-16 items-center justify-center rounded-full">
                        <MdBookmarkBorder size={32} className="text-base-content/40" />
                      </div>
                      <h3 className="text-lg font-semibold">No bookmarks found</h3>
                      <p className="text-base-content/60 text-sm">
                        {searchQuery
                          ? 'Try a different search term.'
                          : 'Bookmark sections of documents to access them quickly.'}
                      </p>
                    </div>
                  ) : (
                    filteredBookmarks
                      .filter((b) => !b.starred)
                      .map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className="group hover:bg-base-200/50 flex items-start gap-4 p-4 transition-colors">
                          {/* Icon */}
                          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
                            <MdBookmark size={20} className="text-primary" />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h4 className="truncate font-medium">{bookmark.title}</h4>
                                <p className="text-base-content/60 mt-0.5 flex items-center gap-1 text-xs">
                                  <MdDescription size={12} />
                                  {bookmark.document}
                                </p>
                              </div>
                              <span className="text-base-content/50 shrink-0 text-xs">
                                {bookmark.createdAt}
                              </span>
                            </div>
                            <p className="text-base-content/70 mt-2 line-clamp-1 text-sm">
                              {bookmark.excerpt}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {bookmark.labels.map((label) => (
                                <span
                                  key={label}
                                  className={`badge badge-sm ${LABEL_COLORS[label] || 'badge-ghost'}`}>
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => toggleBookmarkStar(bookmark.id)}
                              className="btn btn-ghost btn-xs btn-circle"
                              title="Star">
                              <MdStarBorder size={16} />
                            </button>
                            <button className="btn btn-ghost btn-xs btn-circle" title="Open">
                              <MdArrowForward size={16} />
                            </button>
                            <div className="dropdown dropdown-end">
                              <button tabIndex={0} className="btn btn-ghost btn-xs btn-circle">
                                <MdMoreVert size={16} />
                              </button>
                              <ul className="dropdown-content menu bg-base-100 border-base-300 z-10 w-40 rounded-xl border p-2 shadow-lg">
                                <li>
                                  <a>
                                    <MdLabel size={16} /> Edit labels
                                  </a>
                                </li>
                                <li>
                                  <a className="text-error">
                                    <MdDelete size={16} /> Remove
                                  </a>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </ShowcaseLayout>
    </>
  )
}

export default NotificationsShowcase
