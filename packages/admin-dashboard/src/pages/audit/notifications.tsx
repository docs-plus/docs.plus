import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  LuBan,
  LuCircleAlert,
  LuCircleCheck,
  LuMail,
  LuMailWarning,
  LuShieldAlert,
  LuSmartphone
} from 'react-icons/lu'

import { StatCard } from '@/components/cards/StatCard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { BulkActionBar } from '@/components/tables/BulkActionBar'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import {
  disableFailedSubscriptions,
  fetchAuditFailedSubscriptions,
  fetchDLQContents,
  fetchEmailBounces,
  fetchEmailFailureSummary,
  fetchNotificationHealth,
  fetchPushFailureSummary
} from '@/services/api'
import type {
  AuditFailedSubscription,
  EmailBounce,
  EmailFailureSummary,
  NotificationHealth,
  PushFailureSummary
} from '@/types'
import { exportToCSV } from '@/utils/export'
import { formatRelative } from '@/utils/format'

// Disable static generation — pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

// =============================================================================
// Shared UI Helpers
// =============================================================================

/** Platform badge with consistent color coding */
function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, string> = {
    web: 'badge-info',
    ios: 'badge-primary',
    android: 'badge-success',
    desktop: 'badge-ghost'
  }
  return <span className={`badge badge-sm ${config[platform] || 'badge-ghost'}`}>{platform}</span>
}

/** Error category badge with severity coloring */
function CategoryBadge({ category }: { category: string }) {
  const severeCategories = ['EXPIRED', 'NOT_FOUND', 'HARD', 'PERMANENT_FAILURE']
  const warningCategories = ['UNAUTHORIZED', 'TIMEOUT', 'SOFT', 'RATE_LIMITED']
  const badgeClass = severeCategories.includes(category)
    ? 'badge-error'
    : warningCategories.includes(category)
      ? 'badge-warning'
      : 'badge-ghost'
  return <span className={`badge badge-sm ${badgeClass}`}>{category}</span>
}

// =============================================================================
// Push Failure Breakdown
// =============================================================================

function PushFailureBreakdown({
  data,
  isLoading
}: {
  data: PushFailureSummary[] | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-base-content/60 py-8 text-center">
        <LuCircleCheck className="text-success mx-auto mb-2 h-8 w-8" />
        <p className="font-medium">No push failures</p>
        <p className="text-sm">All push subscriptions are healthy</p>
      </div>
    )
  }

  // Aggregate by category for the bar chart
  const byCategory = data.reduce<Record<string, { count: number; users: number }>>((acc, row) => {
    if (!acc[row.error_category]) acc[row.error_category] = { count: 0, users: 0 }
    acc[row.error_category].count += row.failure_count
    acc[row.error_category].users += row.affected_users
    return acc
  }, {})

  const totalFailures = Object.values(byCategory).reduce((sum, v) => sum + v.count, 0)

  // Aggregate by platform
  const byPlatform = data.reduce<Record<string, number>>((acc, row) => {
    acc[row.platform] = (acc[row.platform] || 0) + row.failure_count
    return acc
  }, {})

  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count)

  return (
    <div className="space-y-4">
      {/* Horizontal bar chart */}
      <div className="space-y-2">
        {sortedCategories.map(([category, { count, users }]) => {
          const pct = totalFailures > 0 ? Math.round((count / totalFailures) * 100) : 0
          return (
            <div key={category} className="flex items-center gap-3">
              <div className="w-36 shrink-0">
                <CategoryBadge category={category} />
              </div>
              <div className="bg-base-200 h-5 flex-1 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${
                    ['EXPIRED', 'NOT_FOUND'].includes(category) ? 'bg-error/70' : 'bg-warning/70'
                  }`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="text-base-content/70 w-24 shrink-0 text-right text-sm">
                {count} subs ({pct}%)
              </span>
              <span className="text-base-content/50 hidden w-20 shrink-0 text-right text-xs md:inline">
                {users} users
              </span>
            </div>
          )
        })}
      </div>

      {/* Platform breakdown pills */}
      <div className="flex items-center gap-2 pt-2">
        <span className="text-base-content/60 text-sm font-medium">By Platform:</span>
        {Object.entries(byPlatform).map(([platform, count]) => (
          <span key={platform} className="badge badge-outline badge-sm gap-1">
            {platform}: {count}
          </span>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Email Failure Breakdown
// =============================================================================

function EmailFailureBreakdown({
  data,
  isLoading
}: {
  data: EmailFailureSummary[] | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-base-content/60 py-8 text-center">
        <LuCircleCheck className="text-success mx-auto mb-2 h-8 w-8" />
        <p className="font-medium">No email failures</p>
        <p className="text-sm">All emails delivered successfully</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-sm table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Category</th>
            <th>Count</th>
            <th>Users Affected</th>
            <th>Last Failure</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={`${row.source}-${row.error_category}-${i}`}>
              <td>
                <span
                  className={`badge badge-sm ${row.source === 'bounce' ? 'badge-warning' : 'badge-ghost'}`}>
                  {row.source}
                </span>
              </td>
              <td>
                <CategoryBadge category={row.error_category} />
              </td>
              <td className="font-mono">{row.failure_count}</td>
              <td className="font-mono">{row.affected_users}</td>
              <td className="text-base-content/60 text-xs">
                {row.last_failure_at ? formatRelative(row.last_failure_at) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// Failed Subscriptions Table (with bulk select)
// =============================================================================

function FailedSubscriptionsTable({
  data,
  isLoading,
  onDisable
}: {
  data: AuditFailedSubscription[] | undefined
  isLoading: boolean
  onDisable: (ids: string[]) => void
}) {
  const subs = data || []
  const {
    selectedIds,
    count: selectedCount,
    isSelected,
    isAllSelected,
    isPartialSelected,
    toggleItem,
    toggleAll,
    clearSelection
  } = useBulkSelection(subs, (s) => s.subscription_id)

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  if (subs.length === 0) {
    return (
      <div className="text-base-content/60 py-8 text-center">
        <LuCircleCheck className="text-success mx-auto mb-2 h-8 w-8" />
        <p className="font-medium">No failed subscriptions</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <BulkActionBar count={selectedCount} onClear={clearSelection}>
        <button onClick={() => onDisable([...selectedIds])} className="btn btn-error btn-sm gap-1">
          <LuBan className="h-4 w-4" />
          Disable Selected
        </button>
      </BulkActionBar>

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
              <th>User</th>
              <th>Platform</th>
              <th>Category</th>
              <th>Failures</th>
              <th>Status</th>
              <th>Last Error</th>
              <th>Last Failure</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sub) => (
              <tr
                key={sub.subscription_id}
                className={isSelected(sub.subscription_id) ? 'bg-primary/5' : ''}>
                <td>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={isSelected(sub.subscription_id)}
                    onChange={() => toggleItem(sub.subscription_id)}
                  />
                </td>
                <td className="font-mono text-xs">{sub.username || sub.user_id.slice(0, 8)}</td>
                <td>
                  <PlatformBadge platform={sub.platform} />
                </td>
                <td>
                  <CategoryBadge category={sub.error_category} />
                </td>
                <td>
                  <span className="badge badge-error badge-sm">{sub.failed_count}</span>
                </td>
                <td>
                  {sub.is_active ? (
                    <span className="badge badge-success badge-sm">Active</span>
                  ) : (
                    <span className="badge badge-ghost badge-sm">Disabled</span>
                  )}
                </td>
                <td className="text-error max-w-[200px] truncate text-xs">
                  {sub.last_error || '-'}
                </td>
                <td className="text-base-content/60 text-xs">
                  {sub.last_failure_at ? formatRelative(sub.last_failure_at) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// Email Bounces Table
// =============================================================================

function EmailBouncesTable({
  data,
  isLoading
}: {
  data: EmailBounce[] | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-base-content/60 py-8 text-center">
        <LuCircleCheck className="text-success mx-auto mb-2 h-8 w-8" />
        <p className="font-medium">No email bounces</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-sm table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Type</th>
            <th>Provider</th>
            <th>Reason</th>
            <th>User</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {data.map((bounce) => (
            <tr key={bounce.bounce_id}>
              <td className="font-mono text-xs">{bounce.email}</td>
              <td>
                <CategoryBadge category={bounce.bounce_type.toUpperCase()} />
              </td>
              <td className="text-xs">{bounce.provider || '-'}</td>
              <td className="max-w-[200px] truncate text-xs">{bounce.reason || '-'}</td>
              <td className="font-mono text-xs">{bounce.username || '-'}</td>
              <td className="text-base-content/60 text-xs">
                {bounce.bounced_at ? formatRelative(bounce.bounced_at) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// DLQ Viewer
// =============================================================================

function DLQViewer() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', 'dlq'],
    queryFn: () => fetchDLQContents(20),
    refetchInterval: 60000 // Refresh every minute
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-sm" />
      </div>
    )
  }

  const pushCount = data?.push.count ?? 0
  const emailCount = data?.email.count ?? 0

  if (pushCount === 0 && emailCount === 0) {
    return (
      <div className="text-base-content/60 py-4 text-center text-sm">
        <LuCircleCheck className="text-success mx-auto mb-2 h-6 w-6" />
        Both DLQ queues are empty — no permanently failed jobs
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pushCount > 0 && (
        <div>
          <h4 className="text-sm font-medium">
            Push DLQ <span className="badge badge-error badge-sm ml-1">{pushCount}</span>
          </h4>
          <div className="mt-2 overflow-x-auto">
            <table className="table-xs table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Name</th>
                  <th>Reason</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.push.jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="font-mono text-xs">{job.id}</td>
                    <td className="text-xs">{job.name}</td>
                    <td className="text-error max-w-[200px] truncate text-xs">
                      {job.failedReason || '-'}
                    </td>
                    <td className="text-base-content/60 text-xs">
                      {job.timestamp ? formatRelative(new Date(job.timestamp).toISOString()) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {emailCount > 0 && (
        <div>
          <h4 className="text-sm font-medium">
            Email DLQ <span className="badge badge-error badge-sm ml-1">{emailCount}</span>
          </h4>
          <div className="mt-2 overflow-x-auto">
            <table className="table-xs table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Name</th>
                  <th>Reason</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.email.jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="font-mono text-xs">{job.id}</td>
                    <td className="text-xs">{job.name}</td>
                    <td className="text-error max-w-[200px] truncate text-xs">
                      {job.failedReason || '-'}
                    </td>
                    <td className="text-base-content/60 text-xs">
                      {job.timestamp ? formatRelative(new Date(job.timestamp).toISOString()) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Bulk Cleanup Actions
// =============================================================================

function BulkCleanupActions({
  health,
  onDisable,
  isDisabling
}: {
  health: NotificationHealth | undefined
  onDisable: (minFailures: number, errorPattern: string) => void
  isDisabling: boolean
}) {
  const expiredCount = health?.push.expired_subscriptions ?? 0
  const failedCount = health?.push.failed_subscriptions ?? 0

  if (failedCount === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {expiredCount > 0 && (
        <button
          onClick={() => onDisable(1, '%410%')}
          disabled={isDisabling}
          className="btn btn-error btn-sm gap-1">
          {isDisabling ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <LuBan className="h-4 w-4" />
          )}
          Disable {expiredCount} Expired
        </button>
      )}
      <button
        onClick={() => onDisable(5, '%')}
        disabled={isDisabling}
        className="btn btn-warning btn-sm gap-1">
        {isDisabling ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <LuBan className="h-4 w-4" />
        )}
        Disable All ≥5 Failures
      </button>
    </div>
  )
}

// =============================================================================
// Main Page
// =============================================================================

export default function NotificationAuditPage() {
  const queryClient = useQueryClient()

  // ── Data queries ──────────────────────────────────────────────────────────
  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
    isRefetching
  } = useQuery({
    queryKey: ['admin', 'audit', 'health'],
    queryFn: fetchNotificationHealth
  })

  const {
    data: pushFailures,
    isLoading: pushFailuresLoading,
    refetch: refetchPushFailures
  } = useQuery({
    queryKey: ['admin', 'audit', 'push-failures'],
    queryFn: fetchPushFailureSummary
  })

  const {
    data: emailFailures,
    isLoading: emailFailuresLoading,
    refetch: refetchEmailFailures
  } = useQuery({
    queryKey: ['admin', 'audit', 'email-failures'],
    queryFn: fetchEmailFailureSummary
  })

  const {
    data: failedSubs,
    isLoading: failedSubsLoading,
    refetch: refetchFailedSubs
  } = useQuery({
    queryKey: ['admin', 'audit', 'failed-subscriptions'],
    queryFn: () => fetchAuditFailedSubscriptions(1, 100)
  })

  const {
    data: emailBounces,
    isLoading: emailBouncesLoading,
    refetch: refetchBounces
  } = useQuery({
    queryKey: ['admin', 'audit', 'email-bounces'],
    queryFn: () => fetchEmailBounces({ days: 30, limit: 100 })
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const disableMutation = useMutation({
    mutationFn: ({
      minFailures,
      errorPattern,
      subscriptionIds
    }: {
      minFailures: number
      errorPattern: string
      subscriptionIds?: string[]
    }) => disableFailedSubscriptions(minFailures, errorPattern, subscriptionIds),
    onSuccess: (result) => {
      toast.success(`Disabled ${result.disabled_count} subscription(s)`)
      // Invalidate all audit queries
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to disable subscriptions')
    }
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    refetchHealth()
    refetchPushFailures()
    refetchEmailFailures()
    refetchFailedSubs()
    refetchBounces()
  }, [refetchHealth, refetchPushFailures, refetchEmailFailures, refetchFailedSubs, refetchBounces])

  /** Confirm-then-execute helper for destructive actions */
  const confirmAndDisable = useCallback(
    (
      label: string,
      payload: { minFailures: number; errorPattern: string; subscriptionIds?: string[] }
    ) => {
      toast(
        (t) => (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs opacity-70">This will deactivate matching push subscriptions.</p>
            <div className="flex gap-2">
              <button
                className="btn btn-error btn-xs"
                onClick={() => {
                  disableMutation.mutate(payload)
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
    [disableMutation]
  )

  const handleDisableByPattern = useCallback(
    (minFailures: number, errorPattern: string) => {
      confirmAndDisable('Confirm bulk disable?', { minFailures, errorPattern })
    },
    [confirmAndDisable]
  )

  const handleDisableSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      confirmAndDisable(`Disable ${ids.length} selected subscription(s)?`, {
        minFailures: 1,
        errorPattern: '%',
        subscriptionIds: ids
      })
    },
    [confirmAndDisable]
  )

  const handleExport = useCallback(() => {
    if (!failedSubs || failedSubs.length === 0) return
    exportToCSV(
      failedSubs.map((s) => ({
        user: s.username || s.user_id,
        platform: s.platform,
        category: s.error_category,
        failed_count: s.failed_count,
        is_active: s.is_active,
        last_error: s.last_error || '',
        last_failure: s.last_failure_at || ''
      })),
      'failed-push-subscriptions'
    )
  }, [failedSubs])

  // ── Derived data ──────────────────────────────────────────────────────────
  const pushDeliveryRate = health?.push.delivery_rate ?? 100
  const emailDeliveryRate = health?.email.delivery_rate ?? 100
  const failedSubsCount = health?.push.failed_subscriptions ?? 0
  const hardBounces = health?.email.hard_bounces ?? 0

  // Determine if there's a VAPID/auth issue (UNAUTHORIZED errors present)
  const hasAuthIssue = useMemo(() => {
    return pushFailures?.some((f) => f.error_category === 'UNAUTHORIZED') ?? false
  }, [pushFailures])

  return (
    <>
      <Head>
        <title>Notification Delivery Audit | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Notification Delivery Audit"
          subtitle={
            <span className="flex items-center gap-2">
              <Link href="/notifications" className="link link-hover">
                ← Notifications
              </Link>
              <span className="text-base-content/40">|</span>
              Push &amp; email failure analysis
            </span>
          }
          onRefresh={refreshAll}
          refreshing={isRefetching}
          onExport={handleExport}
          exportLabel="Export Failures"
        />

        <div className="space-y-6 p-6">
          {/* VAPID Auth Alert */}
          {hasAuthIssue && (
            <div className="alert alert-error">
              <LuShieldAlert className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">VAPID Authentication Errors Detected</h3>
                <p className="text-sm">
                  UNAUTHORIZED push failures indicate misconfigured VAPID keys. Check environment
                  variables and regenerate if needed.
                </p>
              </div>
            </div>
          )}

          {/* ── Health Cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard
              title="Push Delivery Rate"
              value={healthLoading ? '—' : `${pushDeliveryRate}%`}
              icon={
                <LuSmartphone
                  className={`h-6 w-6 ${pushDeliveryRate >= 95 ? 'text-success' : pushDeliveryRate >= 80 ? 'text-warning' : 'text-error'}`}
                />
              }
              loading={healthLoading}
            />
            <StatCard
              title="Email Delivery Rate"
              value={healthLoading ? '—' : `${emailDeliveryRate}%`}
              icon={
                <LuMail
                  className={`h-6 w-6 ${emailDeliveryRate >= 95 ? 'text-success' : emailDeliveryRate >= 80 ? 'text-warning' : 'text-error'}`}
                />
              }
              loading={healthLoading}
            />
            <StatCard
              title="Failed Push Subs"
              value={failedSubsCount}
              icon={<LuCircleAlert className="text-warning h-6 w-6" />}
              loading={healthLoading}
            />
            <StatCard
              title="Hard Bounces"
              value={hardBounces}
              icon={<LuMailWarning className="text-error h-6 w-6" />}
              loading={healthLoading}
            />
          </div>

          {/* ── Push Failures ──────────────────────────────────────────────── */}
          <div className="bg-base-100 rounded-box border-base-300 border p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Push Failures by Category</h2>
              <BulkCleanupActions
                health={health}
                onDisable={handleDisableByPattern}
                isDisabling={disableMutation.isPending}
              />
            </div>
            <PushFailureBreakdown data={pushFailures} isLoading={pushFailuresLoading} />
          </div>

          {/* ── Email Failures ─────────────────────────────────────────────── */}
          <div className="bg-base-100 rounded-box border-base-300 border p-5">
            <h2 className="mb-4 text-lg font-semibold">Email Failures</h2>
            <EmailFailureBreakdown data={emailFailures} isLoading={emailFailuresLoading} />
          </div>

          {/* ── Failed Subscriptions Table ─────────────────────────────────── */}
          <CollapsibleSection
            title={`Failed Push Subscriptions (${failedSubs?.length ?? 0})`}
            defaultOpen>
            <FailedSubscriptionsTable
              data={failedSubs}
              isLoading={failedSubsLoading}
              onDisable={handleDisableSelected}
            />
          </CollapsibleSection>

          {/* ── Email Bounces Table ────────────────────────────────────────── */}
          <CollapsibleSection
            title={`Email Bounces (${emailBounces?.length ?? 0})`}
            defaultOpen={false}>
            <EmailBouncesTable data={emailBounces} isLoading={emailBouncesLoading} />
          </CollapsibleSection>

          {/* ── DLQ Viewer ─────────────────────────────────────────────────── */}
          <CollapsibleSection title="Dead Letter Queues" defaultOpen={false}>
            <DLQViewer />
          </CollapsibleSection>
        </div>
      </AdminLayout>
    </>
  )
}
