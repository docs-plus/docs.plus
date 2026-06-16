import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { LuCircle, LuFileText, LuRadio, LuShieldCheck, LuShieldOff } from 'react-icons/lu'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/tables/DataTable'
import { Avatar } from '@/components/ui/Avatar'
import { NotificationBadges } from '@/components/ui/NotificationBadges'
import { SearchInput } from '@/components/ui/SearchInput'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useTableParams } from '@/hooks/useTableParams'
import { supabase } from '@/lib/supabase'
import {
  fetchAdminUserIds,
  fetchUserDocumentCounts,
  fetchUserNotificationSubscriptions,
  fetchUsers,
  toggleAdminRole
} from '@/services/api'
import type { User } from '@/types'
import { confirmToast } from '@/utils/confirmToast'
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
  is_admin: boolean
}

export default function UsersPage() {
  const queryClient = useQueryClient()

  // AuthGuard already gates this page; only the signed-in admin's id is needed
  // here, so read it from the cached session instead of re-running useAdminAuth.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user.id ?? null))
  }, [])

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

  // Fetch admin user IDs
  const { data: adminUsers } = useQuery({
    queryKey: ['admin', 'users', 'admin-ids'],
    queryFn: fetchAdminUserIds
  })

  const adminIdSet = useMemo(() => new Set(adminUsers?.map((a) => a.user_id) || []), [adminUsers])

  // Toggle admin mutation
  const toggleAdminMutation = useMutation({
    mutationFn: toggleAdminRole,
    onSuccess: (result) => {
      toast.success(result.is_admin ? 'Admin role granted' : 'Admin role revoked')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'admin-ids'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to toggle admin role')
    }
  })

  // Merge document counts, notification subs, and admin status into user data
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
        notif_email: subs?.email ?? false,
        is_admin: adminIdSet.has(user.id)
      }
    })
  }, [data?.data, docCounts, notifSubs, adminIdSet])

  // Real-time subscription to users table. Webapp presence/status writes fire
  // often, so debounce the refetch to collapse bursts into one query against
  // the shared DB instead of one per event.
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleRealtimeChange = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current)
    refetchTimer.current = setTimeout(() => refetch(), 1500)
  }, [refetch])
  useEffect(
    () => () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current)
    },
    []
  )

  useRealtimeSubscription({
    table: 'users',
    onChange: handleRealtimeChange
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

  const handleToggleAdmin = useCallback(
    (user: UserWithExtras) => {
      const isSelf = user.id === currentUserId
      if (isSelf) {
        toast.error('Cannot change your own admin status')
        return
      }

      const action = user.is_admin ? 'revoke admin from' : 'grant admin to'
      confirmToast({
        title: `${user.is_admin ? 'Revoke' : 'Grant'} admin role?`,
        body: (
          <>
            This will {action} <strong>{user.username || user.email}</strong>.
          </>
        ),
        confirmClass: user.is_admin ? 'btn-warning' : 'btn-primary',
        onConfirm: () => toggleAdminMutation.mutate(user.id)
      })
    },
    [currentUserId, toggleAdminMutation]
  )

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
          <div className="flex items-center gap-2">
            <span className="font-medium">{user.username || '-'}</span>
            {user.is_admin && (
              <span className="badge badge-primary badge-xs gap-1">
                <LuShieldCheck className="h-3 w-3" />
                Admin
              </span>
            )}
          </div>
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
      render: (user: UserWithExtras) => {
        let statusColor = 'text-base-content/30'
        if (user.status === 'ONLINE') statusColor = 'text-success'
        else if (user.status === 'AWAY') statusColor = 'text-warning'
        return (
          <div className="flex items-center gap-2">
            <LuCircle className={`h-3 w-3 fill-current ${statusColor}`} />
            <span className="text-sm capitalize">{user.status?.toLowerCase()}</span>
          </div>
        )
      }
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
    },
    {
      key: 'actions',
      header: '',
      render: (user: UserWithExtras) => {
        const isSelf = user.id === currentUserId
        let tooltip = user.is_admin ? 'Revoke admin' : 'Make admin'
        if (isSelf) tooltip = 'Cannot change own role'
        return (
          <div className="tooltip tooltip-left" data-tip={tooltip}>
            <button
              type="button"
              className={`btn btn-ghost btn-sm btn-square ${user.is_admin ? 'text-primary' : 'text-base-content/30 hover:text-primary'}`}
              onClick={() => handleToggleAdmin(user)}
              disabled={isSelf || toggleAdminMutation.isPending}>
              {user.is_admin ? (
                <LuShieldCheck className="h-4 w-4" />
              ) : (
                <LuShieldOff className="h-4 w-4" />
              )}
            </button>
          </div>
        )
      }
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
              rowKey={(user) => user.id}
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
