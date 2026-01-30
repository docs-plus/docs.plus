import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { LuCircle, LuFileText,LuRadio } from 'react-icons/lu'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/tables/DataTable'
import { Avatar } from '@/components/ui/Avatar'
import { SearchInput } from '@/components/ui/SearchInput'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useTableParams } from '@/hooks/useTableParams'
import { fetchUserDocumentCounts } from '@/services/api'
import { fetchUsers } from '@/services/supabase'
import type { User } from '@/types'
import { exportToCSV } from '@/utils/export'
import { formatDate, formatDateTime } from '@/utils/format'

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

type UserWithDocs = User & { document_count: number }

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

  // Merge document counts into user data for display
  const usersWithDocCounts = useMemo(() => {
    if (!data?.data) return []
    return data.data.map((user) => ({
      ...user,
      document_count: docCounts?.[user.id] ?? 0
    }))
  }, [data?.data, docCounts])

  // Real-time subscription to users table
  const handleRealtimeChange = useCallback(() => {
    refetch()
  }, [refetch])

  useRealtimeSubscription({
    table: 'users',
    onchange: handleRealtimeChange
  })

  const handleExport = () => {
    if (!usersWithDocCounts.length) {
      toast.error('No data to export')
      return
    }
    exportToCSV(usersWithDocCounts, `users-${new Date().toISOString().split('T')[0]}`, [
      { key: 'username', header: 'Username' },
      { key: 'email', header: 'Email' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'document_count', header: 'Documents' },
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
      render: (user: UserWithDocs) => (
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
      render: (user: UserWithDocs) => <span className="text-sm">{user.email || '-'}</span>
    },
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      render: (user: UserWithDocs) => user.full_name || '-'
    },
    {
      key: 'document_count',
      header: 'Documents',
      render: (user: UserWithDocs) => (
        <div className="flex items-center gap-1.5">
          <LuFileText className="text-base-content/40 h-4 w-4" />
          <span className="text-sm font-medium">{user.document_count}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (user: UserWithDocs) => (
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
      render: (user: UserWithDocs) => <span className="text-sm">{formatDate(user.created_at)}</span>
    },
    {
      key: 'online_at',
      header: 'Last Active',
      sortable: true,
      render: (user: UserWithDocs) => (
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
              data={usersWithDocCounts}
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
