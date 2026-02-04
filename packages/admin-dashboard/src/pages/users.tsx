import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { LuCircle, LuFileText, LuRadio } from 'react-icons/lu'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/tables/DataTable'
import { Avatar } from '@/components/ui/Avatar'
import { NotificationBadges } from '@/components/ui/NotificationBadges'
import { SearchInput } from '@/components/ui/SearchInput'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useTableParams } from '@/hooks/useTableParams'
import { fetchUserDocumentCounts } from '@/services/api'
import { fetchUserNotificationSubscriptions, fetchUsers } from '@/services/supabase'
import type { User } from '@/types'
import { exportToCSV } from '@/utils/export'
import { formatDate, formatDateTime } from '@/utils/format'

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

type UserWithExtras = User & {
  document_count: number
  notif_web: boolean
  notif_ios: boolean
  notif_android: boolean
  notif_email: boolean
}

export default function UsersPage() {
  // URL-synced table state
  const { page, search, sortKey, sortDirection, setPage, setSearch, handleSort } = useTableParams({
    defaultSortKey: 'created_at',
    defaultSortDirection: 'desc'
  })

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'users', page, search, sortKey, sortDirection],
    queryFn: () => fetchUsers(page, search, sortKey || undefined, sortDirection)
  })

  // Fetch document counts per user
  const { data: docCounts } = useQuery({
    queryKey: ['admin', 'users', 'document-counts'],
    queryFn: fetchUserDocumentCounts
  })

  // Fetch notification subscriptions per user
  const { data: notifSubs } = useQuery({
    queryKey: ['admin', 'users', 'notification-subs'],
    queryFn: fetchUserNotificationSubscriptions
  })

  // Merge document counts and notification subs into user data
  const usersWithExtras = useMemo(() => {
    if (!data?.data) return []
    return data.data.map((user) => {
      const subs = notifSubs?.[user.id]
      return {
        ...user,
        document_count: docCounts?.[user.id] ?? 0,
        notif_web: subs?.web ?? false,
        notif_ios: subs?.ios ?? false,
        notif_android: subs?.android ?? false,
        notif_email: subs?.email ?? false
      }
    })
  }, [data?.data, docCounts, notifSubs])

  // Real-time subscription to users table
  const handleRealtimeChange = useCallback(() => {
    refetch()
  }, [refetch])

  useRealtimeSubscription({
    table: 'users',
    onchange: handleRealtimeChange
  })

  const handleExport = () => {
    if (!usersWithExtras.length) {
      toast.error('No data to export')
      return
    }
    exportToCSV(usersWithExtras, `users-${new Date().toISOString().split('T')[0]}`, [
      { key: 'username', header: 'Username' },
      { key: 'email', header: 'Email' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'document_count', header: 'Documents' },
      { key: 'notif_web', header: 'Push Web' },
      { key: 'notif_ios', header: 'Push iOS' },
      { key: 'notif_android', header: 'Push Android' },
      { key: 'notif_email', header: 'Email Notif' },
      { key: 'status', header: 'Status' },
      { key: 'created_at', header: 'Joined' },
      { key: 'online_at', header: 'Last Active' }
    ])
    toast.success('Exported users to CSV')
  }

  const columns = [
    {
      key: 'username',
      header: 'Username',
      sortable: true,
      render: (user: UserWithExtras) => (
        <div className="flex items-center gap-3">
          <Avatar
            userId={user.id}
            avatarUpdatedAt={user.avatar_updated_at}
            src={user.avatar_url}
            name={user.username}
            email={user.email}
            size="md"
          />
          <span className="font-medium">{user.username || '-'}</span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (user: UserWithExtras) => <span className="text-sm">{user.email || '-'}</span>
    },
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      render: (user: UserWithExtras) => user.full_name || '-'
    },
    {
      key: 'document_count',
      header: 'Docs',
      render: (user: UserWithExtras) => (
        <div className="flex items-center gap-1.5">
          <LuFileText className="text-base-content/40 h-4 w-4" />
          <span className="text-sm font-medium">{user.document_count}</span>
        </div>
      )
    },
    {
      key: 'notifications',
      header: 'Notifications',
      render: (user: UserWithExtras) => (
        <NotificationBadges
          web={user.notif_web}
          ios={user.notif_ios}
          android={user.notif_android}
          email={user.notif_email}
        />
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (user: UserWithExtras) => (
        <div className="flex items-center gap-2">
          <LuCircle
            className={`h-3 w-3 fill-current ${
              user.status === 'ONLINE'
                ? 'text-success'
                : user.status === 'AWAY'
                  ? 'text-warning'
                  : 'text-base-content/30'
            }`}
          />
          <span className="text-sm capitalize">{user.status?.toLowerCase()}</span>
        </div>
      )
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      render: (user: UserWithExtras) => (
        <span className="text-sm">{formatDate(user.created_at)}</span>
      )
    },
    {
      key: 'online_at',
      header: 'Last Active',
      sortable: true,
      render: (user: UserWithExtras) => (
        <span className="text-base-content/60 text-sm">
          {user.online_at ? formatDateTime(user.online_at) : '-'}
        </span>
      )
    }
  ]

  return (
    <>
      <Head>
        <title>Users | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Users"
          subtitle={
            <span className="flex items-center gap-2">
              {data?.total || 0} total users
              <span className="badge badge-success badge-xs gap-1">
                <LuRadio className="h-3 w-3" /> Live
              </span>
            </span>
          }
          onRefresh={() => refetch()}
          refreshing={isRefetching}
          onExport={handleExport}
        />

        <div className="space-y-4 p-6">
          {/* Search */}
          <SearchInput
            placeholder="Search by username, email, or name..."
            value={search}
            onSearch={setSearch}
            className="max-w-md"
          />

          {/* Table */}
          <div className="bg-base-100 rounded-box border-base-300 border">
            <DataTable
              columns={columns}
              data={usersWithExtras}
              loading={isLoading}
              pagination={{
                page,
                totalPages: data?.totalPages || 1,
                total: data?.total || 0,
                onPageChange: setPage
              }}
              sorting={{
                sortKey,
                sortDirection,
                onSort: handleSort
              }}
              emptyMessage="No users found"
            />
          </div>
        </div>
      </AdminLayout>
    </>
  )
}
