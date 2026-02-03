import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useCallback } from 'react'

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}
import toast from 'react-hot-toast'
import { LuFileText, LuHash, LuRadio } from 'react-icons/lu'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/tables/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'
import { useTableParams } from '@/hooks/useTableParams'
import { fetchChannels } from '@/services/supabase'
import type { Channel } from '@/types'
import { exportToCSV } from '@/utils/export'
import { formatDate, formatDateTime } from '@/utils/format'

export default function ChannelsPage() {
  // URL-synced table state
  const { page, search, sortKey, sortDirection, setPage, setSearch, handleSort } = useTableParams({
    defaultSortKey: 'last_activity_at',
    defaultSortDirection: 'desc'
  })

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'channels', page, sortKey, sortDirection, search],
    queryFn: () => fetchChannels(page, sortKey || undefined, sortDirection, search || undefined)
  })

  // Real-time subscription to channels table
  const handleRealtimeChange = useCallback(() => {
    refetch()
  }, [refetch])

  useRealtimeSubscription({
    table: 'channels',
    onchange: handleRealtimeChange
  })

  const handleExport = () => {
    if (!data?.data?.length) {
      toast.error('No data to export')
      return
    }
    exportToCSV(data.data, `public-channels-${new Date().toISOString().split('T')[0]}`, [
      { key: 'name', header: 'Name' },
      { key: 'document_slug', header: 'Document Slug' },
      { key: 'document_name', header: 'Document Name' },
      { key: 'member_count', header: 'Members' },
      { key: 'last_activity_at', header: 'Last Activity' },
      { key: 'created_at', header: 'Created' }
    ])
    toast.success('Exported channels to CSV')
  }

  const columns = [
    {
      key: 'name',
      header: 'Channel',
      sortable: true,
      render: (channel: Channel) => (
        <div className="flex items-center gap-2">
          <LuHash className="text-base-content/60 h-4 w-4" />
          <span className="font-medium">{channel.name || 'Unnamed'}</span>
        </div>
      )
    },
    {
      key: 'document',
      header: 'Document',
      render: (channel: Channel) => (
        <div className="flex min-w-0 items-center gap-2">
          {channel.document_slug ? (
            <>
              <LuFileText className="text-base-content/40 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="max-w-[150px] truncate text-sm font-medium">
                  {channel.document_name || channel.document_slug}
                </p>
                <code className="text-base-content/50 text-xs">{channel.document_slug}</code>
              </div>
            </>
          ) : (
            <span className="text-base-content/40 text-sm">-</span>
          )}
        </div>
      )
    },
    {
      key: 'member_count',
      header: 'Members',
      sortable: true,
      render: (channel: Channel) => <span className="text-sm">{channel.member_count}</span>
    },
    {
      key: 'last_activity_at',
      header: 'Last Activity',
      sortable: true,
      render: (channel: Channel) => (
        <span className="text-base-content/60 text-sm">
          {channel.last_activity_at ? formatDateTime(channel.last_activity_at) : '-'}
        </span>
      )
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (channel: Channel) => (
        <span className="text-base-content/60 text-sm">{formatDate(channel.created_at)}</span>
      )
    }
  ]

  return (
    <>
      <Head>
        <title>Public Channels | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Public Channels"
          subtitle={
            <span className="flex items-center gap-2">
              {data?.total || 0} public channels
              <span className="badge badge-success badge-xs gap-1">
                <LuRadio className="h-3 w-3" /> Live
              </span>
            </span>
          }
          onRefresh={() => refetch()}
          refreshing={isRefetching}
          onExport={handleExport}
        />

        <div className="space-y-6 p-6">
          {/* Search */}
          <SearchInput
            placeholder="Search channels by name..."
            value={search}
            onSearch={setSearch}
            className="max-w-md"
          />

          {/* Table */}
          <div className="bg-base-100 rounded-box border-base-300 border">
            <DataTable
              columns={columns}
              data={data?.data || []}
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
              emptyMessage="No channels found"
            />
          </div>
        </div>
      </AdminLayout>
    </>
  )
}
