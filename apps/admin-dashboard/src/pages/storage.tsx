import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { LuBuilding2, LuDatabase, LuFolderOpen, LuHardDrive, LuTriangleAlert } from 'react-icons/lu'

import { StatCard } from '@/components/cards/StatCard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/tables/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { useTableParams } from '@/hooks/useTableParams'
import { fetchMediaStorageExport, fetchMediaStorageList } from '@/services/api'
import type { MediaStorageSortBy, WorkspaceMediaStorageStat } from '@/types'
import { exportToCSV } from '@/utils/export'
import { formatBytes } from '@/utils/format'

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

const EXPORT_COLUMNS = [
  { key: 'workspace', header: 'Workspace' },
  { key: 'slug', header: 'Slug' },
  { key: 'workspace_id', header: 'Workspace ID' },
  { key: 'object_count', header: 'Objects' },
  { key: 'total_bytes', header: 'Used (bytes)' },
  { key: 'quota_bytes', header: 'Quota (bytes)' },
  { key: 'usage_percent', header: 'Usage %' }
] as const

const LOAD_ERROR_FALLBACK =
  'Failed to load media storage stats. Check that the REST API is running.'

const MEDIA_SORT_KEYS = new Set<MediaStorageSortBy>([
  'name',
  'slug',
  'object_count',
  'total_bytes',
  'quota_bytes',
  'usage_percent'
])

function toMediaSortBy(sortKey: string | null): MediaStorageSortBy {
  if (sortKey && MEDIA_SORT_KEYS.has(sortKey as MediaStorageSortBy)) {
    return sortKey as MediaStorageSortBy
  }
  return 'total_bytes'
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : LOAD_ERROR_FALLBACK
}

function rowsToCsv(rows: WorkspaceMediaStorageStat[]) {
  return rows.map((row) => ({
    workspace: row.name ?? '',
    slug: row.slug ?? '',
    workspace_id: row.workspace_id,
    object_count: row.object_count,
    total_bytes: row.total_bytes,
    quota_bytes: row.quota_bytes,
    usage_percent: row.usage_percent
  }))
}

const columns = [
  {
    key: 'name',
    header: 'Workspace',
    sortable: true,
    render: (row: WorkspaceMediaStorageStat) => {
      const overQuota = row.usage_percent >= 100
      return (
        <div className="flex min-w-0 items-center gap-2">
          <LuBuilding2 className="text-base-content/60 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="flex max-w-[200px] items-center gap-2 truncate font-medium">
              {row.name ?? 'Unnamed'}
              {overQuota ? (
                <span className="badge badge-error badge-sm shrink-0">Over quota</span>
              ) : null}
            </p>
            <code className="text-base-content/50 text-xs">{row.workspace_id}</code>
          </div>
        </div>
      )
    }
  },
  {
    key: 'slug',
    header: 'Slug',
    sortable: true,
    render: (row: WorkspaceMediaStorageStat) =>
      row.slug ? (
        <code className="bg-base-200 rounded px-2 py-1 text-sm">{row.slug}</code>
      ) : (
        <span className="text-base-content/40 text-sm">-</span>
      )
  },
  {
    key: 'object_count',
    header: 'Objects',
    sortable: true,
    className: 'text-right',
    render: (row: WorkspaceMediaStorageStat) => (
      <span className="text-sm tabular-nums">{row.object_count.toLocaleString()}</span>
    )
  },
  {
    key: 'total_bytes',
    header: 'Used',
    sortable: true,
    className: 'text-right',
    render: (row: WorkspaceMediaStorageStat) => (
      <span className="text-sm tabular-nums">{formatBytes(row.total_bytes)}</span>
    )
  },
  {
    key: 'quota_bytes',
    header: 'Quota',
    sortable: true,
    className: 'text-right',
    render: (row: WorkspaceMediaStorageStat) => (
      <span className="text-base-content/70 text-sm tabular-nums">
        {formatBytes(row.quota_bytes)}
      </span>
    )
  },
  {
    key: 'usage_percent',
    header: 'Usage',
    sortable: true,
    render: (row: WorkspaceMediaStorageStat) => {
      const overQuota = row.usage_percent >= 100
      return (
        <div className="flex min-w-[8rem] items-center gap-2">
          <progress
            className={`progress w-full ${overQuota ? 'progress-error' : 'progress-primary'}`}
            value={Math.min(row.usage_percent, 100)}
            max={100}
            aria-label={`${row.usage_percent}% of quota used`}
          />
          <span
            className={`w-10 text-right text-xs tabular-nums ${overQuota ? 'text-error font-semibold' : 'text-base-content/70'}`}>
            {row.usage_percent}%
          </span>
        </div>
      )
    }
  }
]

export default function StoragePage() {
  const { page, search, sortKey, sortDirection, setPage, setSearch, handleSort } = useTableParams({
    defaultSortKey: 'total_bytes',
    defaultSortDirection: 'desc'
  })
  const [exporting, setExporting] = useState(false)

  const sortBy = toMediaSortBy(sortKey)

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'media-storage', page, sortBy, sortDirection, search],
    queryFn: () =>
      fetchMediaStorageList(page, 20, {
        search: search || undefined,
        sortBy,
        sortDir: sortDirection
      })
  })

  const summary = data?.summary
  const quotaLabel = summary ? formatBytes(summary.quota_bytes) : '—'

  const handleExport = async () => {
    setExporting(true)
    try {
      const exportData = await fetchMediaStorageExport({
        search: search || undefined,
        sortBy,
        sortDir: sortDirection
      })
      if (!exportData.data.length) {
        toast.error('No data to export')
        return
      }
      exportToCSV(
        rowsToCsv(exportData.data),
        `media-storage-${new Date().toISOString().split('T')[0]}`,
        [...EXPORT_COLUMNS]
      )
      toast.success(`Exported ${exportData.data.length} workspace(s) to CSV`)
    } catch (err) {
      toast.error(loadErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Media Storage | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Media Storage"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {summary?.workspace_count ?? 0} workspace
                {(summary?.workspace_count ?? 0) === 1 ? '' : 's'} with chat media
              </span>
              <span className="text-base-content/40 hidden sm:inline">·</span>
              <span>{quotaLabel} quota per workspace</span>
              <span className="text-base-content/40 hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-1">
                <LuDatabase className="h-3.5 w-3.5" aria-hidden />
                private <code className="font-mono">media</code> bucket
              </span>
            </span>
          }
          onRefresh={() => refetch()}
          refreshing={isRefetching || exporting}
          onExport={() => void handleExport()}
        />

        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Stored"
              value={formatBytes(summary?.total_bytes ?? 0)}
              icon={<LuHardDrive className="h-6 w-6" />}
              loading={isLoading}
            />
            <StatCard
              title="Media Objects"
              value={summary?.total_objects ?? 0}
              icon={<LuFolderOpen className="h-6 w-6" />}
              loading={isLoading}
            />
            <StatCard
              title="Workspaces"
              value={summary?.workspace_count ?? 0}
              icon={<LuBuilding2 className="h-6 w-6" />}
              loading={isLoading}
            />
            <StatCard
              title="Over Quota"
              value={summary?.over_quota_count ?? 0}
              icon={<LuTriangleAlert className="h-6 w-6" />}
              loading={isLoading}
            />
          </div>

          {isError ? (
            <div className="alert alert-error">
              <LuTriangleAlert className="h-5 w-5 shrink-0" />
              <span>{loadErrorMessage(error)}</span>
            </div>
          ) : null}

          <SearchInput
            placeholder="Search by workspace name, slug, or ID..."
            value={search}
            onSearch={setSearch}
            className="max-w-md"
          />

          <div className="bg-base-100 rounded-box border-base-300 border">
            <DataTable
              columns={columns}
              data={data?.data ?? []}
              rowKey={(row) => row.workspace_id}
              loading={isLoading}
              pagination={{
                page,
                totalPages: data?.pagination.totalPages ?? 1,
                total: data?.pagination.total ?? 0,
                onPageChange: setPage
              }}
              sorting={{
                sortKey,
                sortDirection,
                onSort: handleSort
              }}
              emptyMessage={search ? 'No workspaces match your search' : 'No chat media stored yet'}
            />
          </div>
        </div>
      </AdminLayout>
    </>
  )
}
