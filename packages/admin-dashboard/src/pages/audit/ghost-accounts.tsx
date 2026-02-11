import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  LuBan,
  LuGhost,
  LuMail,
  LuRefreshCw,
  LuShieldAlert,
  LuTrash2,
  LuUser,
  LuUserX
} from 'react-icons/lu'

import { StatCard } from '@/components/cards/StatCard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { BulkActionBar } from '@/components/tables/BulkActionBar'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import {
  bulkDeleteGhostAccounts,
  cleanupAnonymousSessions,
  deleteGhostAccount,
  fetchGhostAccounts,
  fetchGhostSummary,
  resendGhostConfirmation
} from '@/services/api'
import type { GhostAccount, GhostSummary, GhostType } from '@/types'
import { exportToCSV } from '@/utils/export'

// Disable static generation — pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

// =============================================================================
// Ghost Type Labels & Colors
// =============================================================================

const GHOST_TYPE_CONFIG: Record<GhostType, { label: string; badge: string; description: string }> =
  {
    unconfirmed_magic_link: {
      label: 'Unconfirmed',
      badge: 'badge-error',
      description: 'Signed up via Magic Link but never confirmed email'
    },
    abandoned_sso: {
      label: 'Abandoned SSO',
      badge: 'badge-warning',
      description: 'Started Google SSO but never completed'
    },
    stale_unconfirmed: {
      label: 'Stale Unconfirmed',
      badge: 'badge-error',
      description: 'Unconfirmed for over 30 days'
    },
    never_signed_in: {
      label: 'Never Signed In',
      badge: 'badge-warning',
      description: 'Account created but never signed in'
    },
    no_public_profile: {
      label: 'No Profile',
      badge: 'badge-info',
      description: 'Auth record exists but no public.users entry'
    },
    stale_anonymous: {
      label: 'Stale Anon',
      badge: 'badge-ghost',
      description: 'Anonymous session older than 30 days'
    },
    orphaned_anonymous: {
      label: 'Orphaned Anon',
      badge: 'badge-ghost',
      description: 'Anonymous session older than 90 days'
    }
  }

function GhostTypeBadge({ type }: { type: GhostType }) {
  const config = GHOST_TYPE_CONFIG[type]
  return (
    <span
      className={`badge badge-sm ${config?.badge || 'badge-ghost'}`}
      title={config?.description}>
      {config?.label || type}
    </span>
  )
}

function ProviderBadge({ provider }: { provider: string }) {
  const config: Record<string, string> = {
    email: 'badge-primary',
    google: 'badge-info',
    anonymous: 'badge-ghost'
  }
  return <span className={`badge badge-sm ${config[provider] || 'badge-ghost'}`}>{provider}</span>
}

// =============================================================================
// Ghost Accounts Table
// =============================================================================

function GhostAccountsTable({
  ghosts,
  isSelected,
  isAllSelected,
  isPartialSelected,
  toggleItem,
  toggleAll,
  onDelete,
  onResend,
  isDeleting
}: {
  ghosts: GhostAccount[]
  isSelected: (id: string) => boolean
  isAllSelected: boolean
  isPartialSelected: boolean
  toggleItem: (id: string) => void
  toggleAll: () => void
  onDelete: (id: string) => void
  onResend: (email: string) => void
  isDeleting: boolean
}) {
  if (ghosts.length === 0) {
    return (
      <div className="rounded-box bg-base-100 border-base-300 flex flex-col items-center justify-center border py-16">
        <LuGhost className="text-success mb-4 h-12 w-12 opacity-40" />
        <p className="text-lg font-semibold">No Ghost Accounts Found</p>
        <p className="text-base-content/60 mt-1 text-sm">All user accounts look healthy.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-sm table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isPartialSelected
                }}
                onChange={toggleAll}
              />
            </th>
            <th>Email / ID</th>
            <th>Type</th>
            <th>Provider</th>
            <th>Age</th>
            <th>Profile?</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ghosts.map((ghost) => (
            <tr key={ghost.id} className="hover">
              <td>
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={isSelected(ghost.id)}
                  onChange={() => toggleItem(ghost.id)}
                />
              </td>
              <td>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {ghost.email || <span className="italic opacity-50">anonymous</span>}
                  </span>
                  <span className="text-base-content/40 font-mono text-xs">
                    {ghost.id.slice(0, 8)}...
                  </span>
                </div>
              </td>
              <td>
                <GhostTypeBadge type={ghost.ghost_type} />
              </td>
              <td>
                <ProviderBadge provider={ghost.provider} />
              </td>
              <td>
                <span className="text-sm">{ghost.age_days}d</span>
              </td>
              <td>
                {ghost.has_public_profile ? (
                  <span className="badge badge-success badge-sm">Yes</span>
                ) : (
                  <span className="badge badge-ghost badge-sm">No</span>
                )}
              </td>
              <td>
                <div className="flex gap-1">
                  {ghost.email &&
                    (ghost.ghost_type === 'unconfirmed_magic_link' ||
                      ghost.ghost_type === 'stale_unconfirmed') && (
                      <button
                        className="btn btn-ghost btn-xs gap-1"
                        onClick={() => onResend(ghost.email!)}
                        title="Resend confirmation email">
                        <LuMail className="h-3 w-3" />
                      </button>
                    )}
                  <button
                    className="btn btn-ghost btn-xs text-error gap-1"
                    onClick={() => onDelete(ghost.id)}
                    disabled={isDeleting}
                    title="Delete account">
                    <LuTrash2 className="h-3 w-3" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// Anonymous Sessions Panel
// =============================================================================

function AnonymousSessionsPanel({
  summary,
  isLoading,
  onCleanup,
  isCleaning
}: {
  summary: GhostSummary | undefined
  isLoading: boolean
  onCleanup: (minAgeDays: number) => void
  isCleaning: boolean
}) {
  const staleAnon = summary?.by_type.stale_anonymous ?? 0
  const orphanedAnon = summary?.by_type.orphaned_anonymous ?? 0
  const total = staleAnon + orphanedAnon

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Stale (30-90d)"
          value={staleAnon}
          icon={<LuUser className="h-5 w-5" />}
          loading={isLoading}
        />
        <StatCard
          title="Orphaned (90d+)"
          value={orphanedAnon}
          icon={<LuUserX className="h-5 w-5" />}
          loading={isLoading}
        />
        <div className="bg-base-100 rounded-box border-base-300 flex flex-col items-center justify-center border p-5">
          <p className="text-base-content/60 mb-3 text-sm">Safe to cleanup</p>
          <button
            className="btn btn-error btn-sm gap-2"
            onClick={() => onCleanup(90)}
            disabled={isCleaning || orphanedAnon === 0}>
            {isCleaning ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <LuTrash2 className="h-4 w-4" />
            )}
            Cleanup 90d+ Anonymous ({orphanedAnon})
          </button>
        </div>
      </div>

      {total === 0 && !isLoading && (
        <div className="alert alert-success">
          <LuGhost className="h-5 w-5" />
          <span>No stale anonymous sessions found. Everything is clean!</span>
        </div>
      )}

      <div className="bg-base-200/50 rounded-box p-4 text-sm">
        <p className="font-medium">About Anonymous Sessions</p>
        <p className="text-base-content/60 mt-1">
          Anonymous sessions are created automatically for document view tracking when visitors
          browse without signing in. Sessions older than 90 days are safe to remove — they have no
          messages, no profile, and no linked identity.
        </p>
      </div>
    </div>
  )
}

// =============================================================================
// Main Page
// =============================================================================

export default function GhostAccountsAuditPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'ghosts' | 'anonymous'>('ghosts')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [minAgeDays, setMinAgeDays] = useState(7)

  // Data fetching
  const {
    data: summaryData,
    isLoading: summaryLoading,
    refetch: refetchSummary
  } = useQuery({
    queryKey: ['ghost-summary'],
    queryFn: fetchGhostSummary,
    staleTime: 60_000
  })

  const {
    data: ghostsData,
    isLoading: ghostsLoading,
    refetch: refetchGhosts
  } = useQuery({
    queryKey: ['ghost-accounts', typeFilter, minAgeDays],
    queryFn: () =>
      fetchGhostAccounts({
        ghostType: typeFilter || undefined,
        minAgeDays,
        perPage: 100
      }),
    staleTime: 60_000
  })

  const ghosts = ghostsData?.ghosts ?? []

  // Bulk selection
  const {
    isSelected,
    isAllSelected,
    isPartialSelected,
    selectedIds,
    count: selectedCount,
    toggleItem,
    toggleAll,
    clearSelection
  } = useBulkSelection(ghosts)

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteGhostAccount(userId),
    onSuccess: (result) => {
      toast.success(
        result.strategy === 'soft_delete'
          ? `Soft-deleted (${result.reason})`
          : 'Account permanently deleted'
      )
      queryClient.invalidateQueries({ queryKey: ['ghost-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['ghost-summary'] })
    },
    onError: () => toast.error('Failed to delete account')
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (userIds: string[]) => bulkDeleteGhostAccounts(userIds),
    onSuccess: (result) => {
      toast.success(
        `Deleted ${result.hard_deleted + result.soft_deleted} accounts (${result.hard_deleted} hard, ${result.soft_deleted} soft)`
      )
      if (result.failed > 0) {
        toast.error(`${result.failed} failed`)
      }
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['ghost-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['ghost-summary'] })
    },
    onError: () => toast.error('Bulk delete failed')
  })

  const resendMutation = useMutation({
    mutationFn: (email: string) => resendGhostConfirmation(email),
    onSuccess: () => toast.success('Confirmation email resent'),
    onError: () => toast.error('Failed to resend confirmation')
  })

  const cleanupMutation = useMutation({
    mutationFn: (minAgeDays: number) => cleanupAnonymousSessions(minAgeDays),
    onSuccess: (result) => {
      toast.success(
        `Cleaned up ${result.deleted} anonymous sessions${result.remaining > 0 ? ` (${result.remaining} remaining)` : ''}`
      )
      queryClient.invalidateQueries({ queryKey: ['ghost-summary'] })
      queryClient.invalidateQueries({ queryKey: ['ghost-accounts'] })
    },
    onError: () => toast.error('Cleanup failed')
  })

  // Handlers
  const handleDelete = useCallback(
    (userId: string) => {
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Delete this account?</p>
            <p className="text-xs opacity-70">
              Will auto-choose hard or soft delete based on message history.
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-error btn-xs"
                onClick={() => {
                  deleteMutation.mutate(userId)
                  toast.dismiss(t.id)
                }}>
                Confirm
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => toast.dismiss(t.id)}>
                Cancel
              </button>
            </div>
          </div>
        ),
        { duration: 10000 }
      )
    },
    [deleteMutation]
  )

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds)
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Delete {ids.length} account(s)?</p>
          <p className="text-xs opacity-70">
            Each account will be hard or soft deleted based on FK dependencies.
          </p>
          <div className="flex gap-2">
            <button
              className="btn btn-error btn-xs"
              onClick={() => {
                bulkDeleteMutation.mutate(ids)
                toast.dismiss(t.id)
              }}>
              Confirm
            </button>
            <button className="btn btn-ghost btn-xs" onClick={() => toast.dismiss(t.id)}>
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: 10000 }
    )
  }, [selectedIds, bulkDeleteMutation])

  const handleResend = useCallback(
    (email: string) => {
      resendMutation.mutate(email)
    },
    [resendMutation]
  )

  const handleCleanup = useCallback(
    (days: number) => {
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Cleanup anonymous sessions?</p>
            <p className="text-xs opacity-70">
              This will permanently delete anonymous auth records older than {days} days.
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-error btn-xs"
                onClick={() => {
                  cleanupMutation.mutate(days)
                  toast.dismiss(t.id)
                }}>
                Confirm
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => toast.dismiss(t.id)}>
                Cancel
              </button>
            </div>
          </div>
        ),
        { duration: 10000 }
      )
    },
    [cleanupMutation]
  )

  const handleRefresh = useCallback(() => {
    refetchSummary()
    refetchGhosts()
    toast.success('Refreshed')
  }, [refetchSummary, refetchGhosts])

  const handleExport = useCallback(() => {
    if (ghosts.length === 0) return
    exportToCSV(
      ghosts.map((g) => ({
        id: g.id,
        email: g.email ?? '',
        provider: g.provider,
        ghost_type: g.ghost_type,
        age_days: g.age_days,
        has_public_profile: g.has_public_profile,
        is_anonymous: g.is_anonymous,
        created_at: g.created_at
      })),
      'ghost-accounts-audit'
    )
  }, [ghosts])

  // Non-anonymous ghost types for the filter dropdown
  const ghostTypeOptions = useMemo(
    () =>
      Object.entries(GHOST_TYPE_CONFIG)
        .filter(([key]) => !key.includes('anonymous'))
        .map(([key, val]) => ({ value: key, label: val.label })),
    []
  )

  const totalGhosts = summaryData?.total_ghosts ?? 0
  const totalAnon =
    (summaryData?.by_type.stale_anonymous ?? 0) + (summaryData?.by_type.orphaned_anonymous ?? 0)
  const nonAnonGhosts = totalGhosts - totalAnon

  return (
    <AdminLayout>
      <Head>
        <title>Ghost Accounts Audit | Admin</title>
      </Head>

      <Header
        title="Ghost Accounts & Anonymous Users Audit"
        subtitle="Identify incomplete signups, stale anonymous sessions, and orphaned accounts"
      />

      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link href="/">Dashboard</Link>
            </li>
            <li>Audit</li>
            <li>Ghost Accounts</li>
          </ul>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Total Ghosts"
            value={totalGhosts}
            icon={<LuGhost className="h-5 w-5" />}
            loading={summaryLoading}
          />
          <StatCard
            title="Unconfirmed"
            value={
              (summaryData?.by_type.unconfirmed_magic_link ?? 0) +
              (summaryData?.by_type.stale_unconfirmed ?? 0)
            }
            icon={<LuMail className="h-5 w-5" />}
            loading={summaryLoading}
          />
          <StatCard
            title="Anonymous Sessions"
            value={totalAnon}
            icon={<LuUserX className="h-5 w-5" />}
            loading={summaryLoading}
          />
          <StatCard
            title="Oldest Ghost"
            value={summaryData?.oldest_ghost_days ? `${summaryData.oldest_ghost_days}d` : '—'}
            icon={<LuShieldAlert className="h-5 w-5" />}
            loading={summaryLoading}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between">
          <div role="tablist" className="tabs tabs-bordered">
            <button
              role="tab"
              className={`tab gap-2 ${activeTab === 'ghosts' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('ghosts')}>
              <LuGhost className="h-4 w-4" />
              Ghost Accounts ({nonAnonGhosts})
            </button>
            <button
              role="tab"
              className={`tab gap-2 ${activeTab === 'anonymous' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('anonymous')}>
              <LuUserX className="h-4 w-4" />
              Anonymous Sessions ({totalAnon})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm gap-1" onClick={handleExport}>
              Export
            </button>
            <button className="btn btn-ghost btn-sm gap-1" onClick={handleRefresh}>
              <LuRefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Ghost Accounts Tab */}
        {activeTab === 'ghosts' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-base-100 rounded-box border-base-300 flex flex-wrap items-center gap-3 border p-3">
              <select
                className="select select-bordered select-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {ghostTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                className="select select-bordered select-sm"
                value={minAgeDays}
                onChange={(e) => setMinAgeDays(parseInt(e.target.value))}>
                <option value={7}>Older than 7 days</option>
                <option value={14}>Older than 14 days</option>
                <option value={30}>Older than 30 days</option>
                <option value={60}>Older than 60 days</option>
                <option value={90}>Older than 90 days</option>
              </select>

              {ghostsLoading && <span className="loading loading-spinner loading-sm" />}
              <span className="text-base-content/60 text-sm">{ghostsData?.total ?? 0} results</span>
            </div>

            {/* Bulk Actions */}
            <BulkActionBar count={selectedCount} onClear={clearSelection}>
              <button
                className="btn btn-error btn-sm gap-1"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}>
                {bulkDeleteMutation.isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <LuTrash2 className="h-4 w-4" />
                )}
                Delete Selected
              </button>
            </BulkActionBar>

            {/* Table */}
            <div className="bg-base-100 rounded-box border-base-300 border">
              <GhostAccountsTable
                ghosts={ghosts.filter((g) => !g.ghost_type.includes('anonymous'))}
                isSelected={isSelected}
                isAllSelected={isAllSelected}
                isPartialSelected={isPartialSelected}
                toggleItem={toggleItem}
                toggleAll={toggleAll}
                onDelete={handleDelete}
                onResend={handleResend}
                isDeleting={deleteMutation.isPending}
              />
            </div>

            {/* Safety Notice */}
            <div className="alert">
              <LuBan className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Smart Deletion</p>
                <p className="text-sm opacity-70">
                  Accounts with messages are soft-deleted (preserves chat history). Accounts without
                  messages are permanently removed. This is automatic — no manual choice needed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Anonymous Sessions Tab */}
        {activeTab === 'anonymous' && (
          <AnonymousSessionsPanel
            summary={summaryData}
            isLoading={summaryLoading}
            onCleanup={handleCleanup}
            isCleaning={cleanupMutation.isPending}
          />
        )}

        {/* Type Breakdown (always visible) */}
        {summaryData && !summaryLoading && (
          <div className="bg-base-100 rounded-box border-base-300 border p-5">
            <h3 className="mb-4 text-lg font-semibold">Ghost Type Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(summaryData.by_type)
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const config = GHOST_TYPE_CONFIG[type as GhostType]
                  const pct = totalGhosts > 0 ? Math.round((count / totalGhosts) * 100) : 0
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="w-36 text-sm">{config?.label || type}</span>
                      <div className="bg-base-200 h-4 flex-1 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-sm font-medium">
                        {count} ({pct}%)
                      </span>
                    </div>
                  )
                })}
            </div>

            {totalGhosts === 0 && (
              <p className="text-success text-center text-sm font-medium">
                All clear — no ghost accounts detected!
              </p>
            )}
          </div>
        )}

        {/* Public Users Health */}
        {summaryData?.public_users && !summaryLoading && (
          <div className="bg-base-100 rounded-box border-base-300 border p-5">
            <h3 className="mb-4 text-lg font-semibold">Public Users Health</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{summaryData.public_users.total_public_users}</p>
                <p className="text-base-content/60 text-sm">Total Profiles</p>
              </div>
              <div className="text-center">
                <p className="text-success text-2xl font-bold">
                  {summaryData.public_users.active_count}
                </p>
                <p className="text-base-content/60 text-sm">Active</p>
              </div>
              <div className="text-center">
                <p className="text-warning text-2xl font-bold">
                  {summaryData.public_users.never_active_count}
                </p>
                <p className="text-base-content/60 text-sm">Never Active</p>
              </div>
              <div className="text-center">
                <p className="text-error text-2xl font-bold">
                  {summaryData.public_users.soft_deleted_count}
                </p>
                <p className="text-base-content/60 text-sm">Soft Deleted</p>
              </div>
            </div>

            <div className="mt-4 text-sm">
              <span className="text-base-content/60">
                Auth users: {summaryData.total_auth_users} | Public profiles:{' '}
                {summaryData.public_users.total_public_users} | Gap:{' '}
                {summaryData.total_auth_users - summaryData.public_users.total_public_users}
                {' (includes anonymous sessions)'}
              </span>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
