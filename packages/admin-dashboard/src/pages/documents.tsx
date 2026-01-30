import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useCallback,useState } from 'react'

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}
import toast from 'react-hot-toast'
import { LuChartBar,LuEye, LuFileText, LuLock, LuUsers } from 'react-icons/lu'

import { StatCard } from '@/components/cards/StatCard'
import { ActionsDropdown, DeleteModal } from '@/components/documents'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/tables/DataTable'
import { Avatar } from '@/components/ui/Avatar'
import { SearchInput } from '@/components/ui/SearchInput'
import { useTableParams } from '@/hooks/useTableParams'
import {
  deleteDocument,
  fetchDocuments,
  fetchDocumentStats,
  updateDocumentFlags} from '@/services/api'
import type { Document } from '@/types'
import { exportToCSV } from '@/utils/export'
import { formatDate, formatDateTime } from '@/utils/format'

export default function DocumentsPage() {
  // URL-synced table state
  const { page, search, sortKey, sortDirection, setPage, setSearch, handleSort } = useTableParams({
    defaultSortKey: 'updatedAt',
    defaultSortDirection: 'desc'
  })

  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'documents', page, sortKey, sortDirection, search],
    queryFn: () =>
      fetchDocuments(page, 20, sortKey || undefined, sortDirection, search || undefined)
  })

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['admin', 'documents', 'stats'],
    queryFn: fetchDocumentStats
  })

  // Mutation for updating document flags
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      flags
    }: {
      id: string
      flags: { isPrivate?: boolean; readOnly?: boolean }
    }) => updateDocumentFlags(id, flags),
    onMutate: ({ id }) => setUpdatingId(id),
    onSuccess: (_, { flags }) => {
      const flagName = flags.isPrivate !== undefined ? 'visibility' : 'read-only status'
      toast.success(`Document ${flagName} updated`)
      refetch()
      refetchStats()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update document')
    },
    onSettled: () => setUpdatingId(null)
  })

  // Mutation for deleting documents (with confirmSlug)
  const deleteMutation = useMutation({
    mutationFn: ({ id, confirmSlug }: { id: string; confirmSlug: string }) =>
      deleteDocument(id, confirmSlug),
    onSuccess: (result) => {
      toast.success(`Deleted "${result.deleted.title || result.deleted.slug}" and all related data`)
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] })
      refetchStats()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document')
    }
  })

  const handleTogglePrivate = useCallback(
    (doc: Document) => {
      updateMutation.mutate({ id: doc.id, flags: { isPrivate: !doc.isPrivate } })
    },
    [updateMutation]
  )

  const handleToggleReadOnly = useCallback(
    (doc: Document) => {
      updateMutation.mutate({ id: doc.id, flags: { readOnly: !doc.readOnly } })
    },
    [updateMutation]
  )

  const handleDeleteConfirm = useCallback(
    (confirmSlug: string) => {
      if (deleteTarget) {
        deleteMutation.mutate({ id: deleteTarget.id, confirmSlug })
      }
    },
    [deleteTarget, deleteMutation]
  )

  const handleExport = () => {
    if (!data?.data?.length) {
      toast.error('No data to export')
      return
    }
    const exportData = data.data.map((doc) => ({
      ...doc,
      owner: doc.ownerName || doc.ownerEmail || '',
      isPrivate: doc.isPrivate ? 'Yes' : 'No',
      readOnly: doc.readOnly ? 'Yes' : 'No'
    }))
    exportToCSV(exportData, `documents-${new Date().toISOString().split('T')[0]}`, [
      { key: 'docId', header: 'Slug' },
      { key: 'title', header: 'Title' },
      { key: 'owner', header: 'Owner' },
      { key: 'memberCount', header: 'Members' },
      { key: 'views7d', header: 'Views (7d)' },
      { key: 'isPrivate', header: 'Private' },
      { key: 'readOnly', header: 'Read Only' },
      { key: 'versionCount', header: 'Versions' },
      { key: 'createdAt', header: 'Created' },
      { key: 'updatedAt', header: 'Updated' }
    ])
    toast.success('Exported documents to CSV')
  }

  const columns = [
    {
      key: 'title',
      header: 'Document',
      sortable: true,
      render: (doc: Document) => (
        <div className="min-w-0">
          <p className="max-w-[200px] truncate font-medium">{doc.title || doc.docId}</p>
          <code className="text-base-content/50 text-xs">{doc.docId}</code>
        </div>
      )
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (doc: Document) => (
        <div className="flex items-center gap-2">
          {doc.ownerName || doc.ownerEmail ? (
            <>
              <Avatar
                userId={doc.ownerId}
                avatarUpdatedAt={doc.ownerAvatarUpdatedAt}
                src={doc.ownerAvatarUrl}
                name={doc.ownerName}
                email={doc.ownerEmail}
                size="sm"
              />
              <span className="max-w-[100px] truncate text-sm">
                {doc.ownerName || doc.ownerEmail?.split('@')[0]}
              </span>
            </>
          ) : (
            <span className="text-base-content/40 text-sm">No owner</span>
          )}
        </div>
      )
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (doc: Document) => (
        <div className="flex flex-wrap gap-1.5">
          {doc.isPrivate && (
            <span className="badge badge-sm badge-warning gap-1">
              <LuLock className="h-3 w-3" /> Private
            </span>
          )}
          {doc.readOnly && (
            <span className="badge badge-sm badge-info gap-1">
              <LuEye className="h-3 w-3" /> Read-only
            </span>
          )}
          {!doc.isPrivate && !doc.readOnly && (
            <span className="text-base-content/40 text-sm">Public</span>
          )}
        </div>
      )
    },
    {
      key: 'members',
      header: 'Members',
      render: (doc: Document) => (
        <div className="flex items-center gap-1.5">
          <LuUsers className="text-base-content/40 h-4 w-4" />
          <span className="text-sm font-medium">{doc.memberCount}</span>
        </div>
      )
    },
    {
      key: 'views7d',
      header: 'Views (7d)',
      sortable: true,
      render: (doc: Document) => (
        <div className="flex items-center gap-1.5">
          <LuChartBar className="text-base-content/40 h-4 w-4" />
          <span className="text-sm font-medium">
            {doc.views7d !== undefined ? doc.views7d.toLocaleString() : '—'}
          </span>
        </div>
      )
    },
    {
      key: 'versionCount',
      header: 'Versions',
      sortable: true,
      render: (doc: Document) => (
        <span className="badge badge-ghost badge-sm">{doc.versionCount}</span>
      )
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: (doc: Document) => (
        <span className="text-base-content/70 text-sm">{formatDateTime(doc.updatedAt)}</span>
      )
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (doc: Document) => (
        <span className="text-base-content/50 text-sm">{formatDate(doc.createdAt)}</span>
      )
    },
    {
      key: 'actions',
      header: '',
      render: (doc: Document) => (
        <ActionsDropdown
          doc={doc}
          onTogglePrivate={() => handleTogglePrivate(doc)}
          onToggleReadOnly={() => handleToggleReadOnly(doc)}
          onDelete={() => setDeleteTarget(doc)}
          isUpdating={updatingId === doc.id}
        />
      )
    }
  ]

  return (
    <>
      <Head>
        <title>Documents | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Documents"
          subtitle={`${data?.pagination.total || 0} total documents`}
          onRefresh={() => refetch()}
          refreshing={isRefetching}
          onExport={handleExport}
        />

        <div className="space-y-6 p-6">
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard
              title="Total Documents"
              value={stats?.total ?? 0}
              icon={<LuFileText className="h-6 w-6" />}
              loading={statsLoading}
            />
            <StatCard
              title="Private"
              value={stats?.private ?? 0}
              icon={<LuLock className="h-6 w-6" />}
              loading={statsLoading}
            />
            <StatCard
              title="Read-Only"
              value={stats?.readOnly ?? 0}
              icon={<LuEye className="h-6 w-6" />}
              loading={statsLoading}
            />
            <StatCard
              title="Total Versions"
              value={stats?.totalVersions ?? 0}
              loading={statsLoading}
            />
          </div>

          {/* Search */}
          <SearchInput
            placeholder="Search documents by title, slug, or owner..."
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
                totalPages: data?.pagination.totalPages || 1,
                total: data?.pagination.total || 0,
                onPageChange: setPage
              }}
              sorting={{
                sortKey,
                sortDirection,
                onSort: handleSort
              }}
              emptyMessage="No documents found"
            />
          </div>
        </div>

        {/* Delete confirmation modal */}
        <DeleteModal
          isOpen={!!deleteTarget}
          doc={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={deleteMutation.isPending}
        />
      </AdminLayout>
    </>
  )
}
