import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import {
  LuArrowLeft,
  LuDownload,
  LuEye,
  LuFileWarning,
  LuHardDrive,
  LuInfo,
  LuTrash2
} from 'react-icons/lu'

import { SectionCard } from '@/components/cards/SectionCard'
import { StatCard } from '@/components/cards/StatCard'
import { StalePreviewModal } from '@/components/documents'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { BulkActionBar } from '@/components/tables/BulkActionBar'
import { DataTable } from '@/components/tables/DataTable'
import { Avatar } from '@/components/ui/Avatar'
import { APP_URL } from '@/constants/config'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { useTableParams } from '@/hooks/useTableParams'
import {
  bulkDeleteStaleDocuments,
  fetchStaleDocuments,
  fetchStaleDocumentsSummary
} from '@/services/api'
import type { StaleDocument } from '@/types'
import { exportToCSV } from '@/utils/export'
import { formatBytes, formatRelative, userLabel } from '@/utils/format'

// Disable static generation
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

// Mirrors the server stale_score bands; the badge text stays the server reason.
const STALE_TIERS = [
  {
    min: 100,
    label: 'Truly Abandoned',
    tone: 'badge-error badge-sm',
    logic: '0 views in 30 days AND no edits for 90+ days'
  },
  {
    min: 90,
    label: 'Ghost Document',
    tone: 'badge-warning badge-sm',
    logic: '0 views in 7 days AND only 1 version (never really used)'
  },
  {
    min: 70,
    label: 'Declining Interest',
    tone: 'badge-soft badge-info badge-sm text-[var(--info-ink)]',
    logic: '0 views in 7 days AND no edits for 30+ days'
  },
  {
    min: 50,
    label: 'Low Engagement',
    tone: 'badge-ghost badge-sm',
    logic: 'Less than 3 views in 7 days AND no edits for 60+ days'
  }
]

function getScoreBadge(score: number, reason: string) {
  const tier = STALE_TIERS.find((t) => score >= t.min)
  if (!tier) return <span className="badge badge-ghost badge-sm">{reason || 'Low'}</span>
  return <span className={`badge ${tier.tone}`}>{reason}</span>
}

export default function StaleDocumentsPage() {
  const queryClient = useQueryClient()
  const { page, sortKey, sortDirection, setPage, handleSort } = useTableParams({
    defaultSortKey: 'stale_score',
    defaultSortDirection: 'desc'
  })

  const [previewSlug, setPreviewSlug] = useState<string | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['admin', 'stale-documents', 'summary'],
    queryFn: fetchStaleDocumentsSummary
  })

  const {
    data: staleData,
    isLoading,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['admin', 'stale-documents', page, sortKey, sortDirection],
    queryFn: () =>
      fetchStaleDocuments(page, 20, {
        minScore: 20, // Show all stale documents
        sortBy: sortKey || 'stale_score',
        sortDir: sortDirection
      })
  })

  const {
    selectedItems,
    count: selectedCount,
    isSelected,
    isAllSelected,
    isPartialSelected,
    toggleItem,
    toggleAll,
    clearSelection
  } = useBulkSelection(staleData?.data || [], (doc) => doc.slug)

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => bulkDeleteStaleDocuments([slug]),
    onSuccess: (result) => {
      if (result.deleted > 0) {
        toast.success(
          `Deleted "${result.deletedDocuments[0]?.title || result.deletedDocuments[0]?.slug}"`
        )
      } else {
        // The service refuses a slug that is no longer stale and says so per
        // document. Without this the operator sees a bare failure and retries.
        toast.error(result.failedDocuments?.[0]?.error || 'Failed to delete document')
      }
      setPreviewSlug(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'stale-documents'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document')
    }
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (slugs: string[]) => bulkDeleteStaleDocuments(slugs),
    onSuccess: (result) => {
      toast.success(`Deleted ${result.deleted} document${result.deleted !== 1 ? 's' : ''}`)
      if (result.failed > 0) {
        toast.error(`Failed to delete ${result.failed} document${result.failed !== 1 ? 's' : ''}`)
      }
      setConfirmBulkDelete(false)
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['admin', 'stale-documents'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete documents')
    }
  })

  const handleSingleDelete = useCallback(
    (slug: string) => {
      deleteMutation.mutate(slug)
    },
    [deleteMutation]
  )

  const handleBulkDelete = useCallback(() => {
    const slugs = selectedItems.map((d) => d.slug)
    bulkDeleteMutation.mutate(slugs)
  }, [selectedItems, bulkDeleteMutation])

  const handleExport = (rows: StaleDocument[]) => {
    if (!rows.length) {
      toast.error('No data to export')
      return
    }
    exportToCSV(rows, `stale-documents-${new Date().toISOString().split('T')[0]}`, [
      { key: 'slug', header: 'Slug' },
      { key: 'title', header: 'Title' },
      { key: 'stale_reason', header: 'Status' },
      { key: 'stale_score', header: 'Score' },
      { key: 'views_7d', header: 'Views (7d)' },
      { key: 'views_30d', header: 'Views (30d)' },
      { key: 'version_count', header: 'Versions' },
      { key: 'age_days', header: 'Age (days)' },
      { key: 'days_inactive', header: 'Inactive (days)' },
      { key: 'created_at', header: 'Created' },
      { key: 'updated_at', header: 'Updated' }
    ])
    toast.success('Exported stale documents to CSV')
  }

  const columns = [
    {
      key: 'checkbox',
      header: (
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={isAllSelected}
          ref={(el) => {
            if (el) el.indeterminate = isPartialSelected
          }}
          onChange={toggleAll}
        />
      ),
      render: (doc: StaleDocument) => (
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={isSelected(doc.slug)}
          onChange={() => toggleItem(doc.slug)}
        />
      )
    },
    {
      key: 'title',
      header: 'Document',
      render: (doc: StaleDocument) => (
        <div className="min-w-0">
          <a
            href={`${APP_URL}/${doc.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-hover max-w-[180px] truncate text-left font-medium"
            title="Open document in new tab">
            {doc.title || doc.slug}
          </a>
          <code className="text-base-content/60 block text-xs">{doc.slug}</code>
        </div>
      )
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (doc: StaleDocument) => (
        <div className="flex items-center gap-2">
          {doc.owner_name || doc.owner_email ? (
            <>
              <Avatar
                userId={doc.owner_id}
                src={doc.owner_avatar_url}
                name={doc.owner_name}
                email={doc.owner_email}
                size="sm"
              />
              <span className="max-w-[80px] truncate text-sm">
                {userLabel(doc.owner_name, doc.owner_email)}
              </span>
            </>
          ) : (
            <span className="text-base-content/60 text-sm">No owner</span>
          )}
        </div>
      )
    },
    {
      key: 'stale_score',
      header: 'Status',
      sortable: true,
      render: (doc: StaleDocument) => getScoreBadge(doc.stale_score, doc.stale_reason)
    },
    {
      key: 'views',
      header: 'Views',
      render: (doc: StaleDocument) => (
        <div className="text-base-content/70 space-y-0.5 text-xs">
          <div className="flex items-center gap-1">
            <LuEye className="h-3 w-3" />
            {doc.views_7d}
            <span className="text-base-content/60">7d</span>
          </div>
          <div className="text-base-content/60">{doc.views_30d} 30d</div>
        </div>
      )
    },
    {
      key: 'stats',
      header: 'Stats',
      render: (doc: StaleDocument) => (
        <div className="text-base-content/70 space-y-0.5 text-xs">
          <div>
            {doc.version_count}v · {doc.age_days}d
          </div>
          <div>
            {doc.structure.headings}h · {doc.structure.paragraphs}p
          </div>
        </div>
      )
    },
    {
      key: 'days_inactive',
      header: 'Last Edit',
      sortable: true,
      render: (doc: StaleDocument) => (
        <span className="text-base-content/70 text-sm">{formatRelative(doc.updated_at)}</span>
      )
    },
    {
      key: 'actions',
      header: '',
      render: (doc: StaleDocument) => (
        <button
          className="btn btn-ghost btn-sm btn-square"
          onClick={() => setPreviewSlug(doc.slug)}
          aria-label={`Preview and delete ${doc.title || doc.slug}`}
          title="Preview & Delete">
          <LuTrash2 className="h-4 w-4" />
        </button>
      )
    }
  ]

  return (
    <>
      <Head>
        <title>Stale Documents Audit | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Stale Documents Audit"
          subtitle="Find and cleanup empty, abandoned, or barely-used documents"
          onRefresh={() => refetch()}
          refreshing={isRefetching}
          onExport={() => handleExport(staleData?.data || [])}
        />

        <div className="space-y-6 p-6">
          <Link href="/documents" className="btn btn-ghost btn-sm gap-2">
            <LuArrowLeft className="h-4 w-4" />
            Back to Documents
          </Link>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            <StatCard
              title="Total Stale"
              value={summary?.total_stale ?? 0}
              icon={<LuFileWarning className="h-6 w-6" />}
              loading={summaryLoading}
            />
            <StatCard
              title="Truly Abandoned"
              value={summary?.truly_abandoned ?? 0}
              loading={summaryLoading}
              className="border-error/20"
            />
            <StatCard
              title="Ghost Documents"
              value={summary?.ghost_document ?? 0}
              loading={summaryLoading}
              className="border-warning/20"
            />
            <StatCard
              title="Declining"
              value={summary?.declining ?? 0}
              loading={summaryLoading}
              className="border-info/20"
            />
            <StatCard
              title="Low Engagement"
              value={summary?.low_engagement ?? 0}
              loading={summaryLoading}
            />
            <StatCard
              title="Recoverable"
              value={formatBytes(summary?.recoverable_bytes ?? 0)}
              icon={<LuHardDrive className="h-6 w-6" />}
              loading={summaryLoading}
            />
          </div>

          <BulkActionBar count={selectedCount} onClear={clearSelection}>
            {confirmBulkDelete ? (
              <>
                <span className="text-sm font-medium text-[var(--error-ink)]">
                  Delete {selectedCount} document{selectedCount !== 1 ? 's' : ''}?
                </span>
                <button
                  className="btn btn-error btn-sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}>
                  {bulkDeleteMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <LuTrash2 className="h-4 w-4" />
                  )}
                  Confirm Delete
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmBulkDelete(false)}
                  disabled={bulkDeleteMutation.isPending}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-error btn-sm gap-1"
                  onClick={() => setConfirmBulkDelete(true)}>
                  <LuTrash2 className="h-4 w-4" />
                  Delete Selected
                </button>
                <button
                  className="btn btn-ghost btn-sm gap-1"
                  onClick={() => handleExport(selectedItems)}>
                  <LuDownload className="h-4 w-4" />
                  Export Selected
                </button>
              </>
            )}
          </BulkActionBar>

          <div className="collapse-arrow bg-base-200/50 border-base-300 collapse border">
            <input type="checkbox" />
            <div className="collapse-title flex items-center gap-2 text-sm font-medium">
              <LuInfo className="h-4 w-4" />
              How We Detect Stale Documents (Industry Standard)
            </div>
            <div className="collapse-content">
              <div className="prose prose-sm max-w-none pt-2">
                <p className="text-base-content/70">
                  We use a <strong>multi-signal approach</strong> that combines{' '}
                  <strong>edit activity</strong> AND <strong>view activity</strong> to determine
                  staleness. A document being read means it's still valuable, even if it hasn't been
                  edited.
                </p>
                <table className="table-zebra table-sm table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Score</th>
                      <th>Detection Logic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STALE_TIERS.map((tier) => (
                      <tr key={tier.min}>
                        <td>
                          <span className={`badge ${tier.tone}`}>{tier.label}</span>
                        </td>
                        <td>{tier.min}</td>
                        <td>{tier.logic}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-base-content/60 text-xs">
                  <strong>Not Stale:</strong> Documents with 3+ views in the last 7 days OR recently
                  edited are considered active and won't appear here.
                </p>
              </div>
            </div>
          </div>

          <div className="text-base-content/60 flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium">Legend:</span>
            {STALE_TIERS.map((tier) => (
              <span key={tier.min} className={`badge ${tier.tone}`}>
                {tier.label}
              </span>
            ))}
            <span className="ml-4">v=versions d=days h=headings p=paragraphs</span>
          </div>

          <SectionCard>
            <DataTable
              columns={columns}
              data={staleData?.data || []}
              rowKey={(doc) => doc.slug}
              loading={isLoading}
              pagination={{
                page,
                totalPages: staleData?.pagination.totalPages || 1,
                total: staleData?.pagination.total || 0,
                onPageChange: setPage
              }}
              sorting={{
                sortKey: sortKey || 'stale_score',
                sortDirection,
                onSort: handleSort
              }}
              emptyMessage="No stale documents found"
            />
          </SectionCard>
        </div>

        {previewSlug && (
          <StalePreviewModal
            key={previewSlug}
            slug={previewSlug}
            onConfirmDelete={handleSingleDelete}
            onCancel={() => setPreviewSlug(null)}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </AdminLayout>
    </>
  )
}
