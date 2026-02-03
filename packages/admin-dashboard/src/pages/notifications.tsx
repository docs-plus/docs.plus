import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useCallback, useState } from 'react'

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}
import {
  LuBell,
  LuBellOff,
  LuCheck,
  LuChevronDown,
  LuChevronUp,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleX,
  LuClock,
  LuDatabase,
  LuMail,
  LuRadio,
  LuRefreshCw,
  LuServer,
  LuSmartphone,
  LuTriangleAlert,
  LuWifi
} from 'react-icons/lu'

import { StatCard } from '@/components/cards/StatCard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { useMultiTableSubscription } from '@/hooks/useRealtimeSubscription'
import {
  checkEmailGatewayHealth,
  checkPushGatewayHealth,
  type PushGatewayHealth
} from '@/services/api'
import {
  fetchEmailStats,
  fetchFailedPushSubscriptions,
  fetchNotificationStats,
  fetchPushPipelineStats,
  fetchPushStats,
  fetchRecentPushActivity
} from '@/services/supabase'
import type { PushPipelineStats, PushSubscriptionDetail } from '@/types'
import { formatRelative } from '@/utils/format'

// Status indicator component
function StatusBadge({
  status
}: {
  status: 'healthy' | 'degraded' | 'down' | 'ok' | 'error' | 'warning'
}) {
  const config = {
    healthy: { color: 'badge-success', icon: LuCircleCheck, text: 'Healthy' },
    ok: { color: 'badge-success', icon: LuCircleCheck, text: 'OK' },
    degraded: { color: 'badge-warning', icon: LuTriangleAlert, text: 'Degraded' },
    warning: { color: 'badge-warning', icon: LuTriangleAlert, text: 'Warning' },
    down: { color: 'badge-error', icon: LuCircleX, text: 'Down' },
    error: { color: 'badge-error', icon: LuCircleX, text: 'Error' }
  }
  const { color, icon: Icon, text } = config[status]
  return (
    <span className={`badge ${color} gap-1`}>
      <Icon className="h-3 w-3" />
      {text}
    </span>
  )
}

// Push Pipeline Flow Visualization
function PushPipelineFlow({
  pipeline,
  gatewayHealth
}: {
  pipeline: PushPipelineStats | null
  gatewayHealth: PushGatewayHealth | null
}) {
  const steps = [
    {
      name: 'DB Trigger',
      icon: LuDatabase,
      status: pipeline?.triggerConfigured ? 'ok' : 'error',
      detail: pipeline?.triggerConfigured ? 'pgmq enqueue' : 'Not configured'
    },
    {
      name: 'pgmq Queue',
      icon: LuWifi,
      status: pipeline?.queueDepth !== undefined ? 'ok' : 'warning',
      detail: pipeline ? `${pipeline.queueDepth} in queue` : 'No data'
    },
    {
      name: 'Consumer',
      icon: LuServer,
      status: gatewayHealth?.status === 'healthy' ? 'ok' : gatewayHealth?.status || 'error',
      detail: gatewayHealth
        ? `${gatewayHealth.latency}ms${gatewayHealth.vapidConfigured ? '' : ' (no VAPID)'}`
        : 'Checking...'
    },
    {
      name: 'BullMQ Queue',
      icon: LuClock,
      status: gatewayHealth?.queueConnected ? 'ok' : 'error',
      detail: gatewayHealth?.queueConnected
        ? `${gatewayHealth.pendingJobs ?? 0} pending`
        : 'Disconnected'
    },
    {
      name: 'Subscriptions',
      icon: LuSmartphone,
      status:
        pipeline && pipeline.activeSubscriptions > 0
          ? pipeline.failedSubscriptions > 0
            ? 'warning'
            : 'ok'
          : 'warning',
      detail: pipeline
        ? `${pipeline.activeSubscriptions} active, ${pipeline.failedSubscriptions} failed`
        : 'No data'
    }
  ]

  return (
    <div className="bg-base-100 rounded-box border-base-300 border p-5">
      <h3 className="mb-4 text-lg font-semibold">Push Notification Pipeline</h3>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {steps.map((step, i) => (
          <div key={step.name} className="flex items-center gap-2">
            <div
              className={`flex flex-col items-center rounded-lg p-3 ${
                step.status === 'ok'
                  ? 'bg-success/10'
                  : step.status === 'warning'
                    ? 'bg-warning/10'
                    : 'bg-error/10'
              }`}>
              <step.icon
                className={`h-6 w-6 ${
                  step.status === 'ok'
                    ? 'text-success'
                    : step.status === 'warning'
                      ? 'text-warning'
                      : 'text-error'
                }`}
              />
              <span className="mt-1 text-xs font-medium">{step.name}</span>
              <span className="text-base-content/60 max-w-[120px] truncate text-[10px]">
                {step.detail}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="text-base-content/40 hidden text-xl md:inline">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Failed Subscriptions Table
function FailedSubscriptionsTable({ subscriptions }: { subscriptions: PushSubscriptionDetail[] }) {
  if (subscriptions.length === 0) {
    return (
      <div className="text-base-content/60 py-8 text-center">
        <LuCircleCheck className="text-success mx-auto mb-2 h-8 w-8" />
        <p>No failed subscriptions</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-sm table">
        <thead>
          <tr>
            <th>User</th>
            <th>Device</th>
            <th>Platform</th>
            <th>Failures</th>
            <th>Last Error</th>
            <th>Last Used</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id}>
              <td className="font-mono text-xs">{sub.username || sub.user_id.slice(0, 8)}</td>
              <td className="max-w-[150px] truncate text-xs">{sub.device_name || 'Unknown'}</td>
              <td>
                <span className="badge badge-ghost badge-sm">{sub.platform}</span>
              </td>
              <td>
                <span className="badge badge-error badge-sm">{sub.failed_count}</span>
              </td>
              <td className="text-error max-w-[200px] truncate text-xs">{sub.last_error || '-'}</td>
              <td className="text-base-content/60 text-xs">
                {sub.last_used_at ? formatRelative(sub.last_used_at) : 'Never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Recent Push Activity Table
function RecentActivityTable({ subscriptions }: { subscriptions: PushSubscriptionDetail[] }) {
  if (subscriptions.length === 0) {
    return (
      <div className="text-base-content/60 py-8 text-center">
        <LuClock className="mx-auto mb-2 h-8 w-8" />
        <p>No recent push activity</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-sm table">
        <thead>
          <tr>
            <th>User</th>
            <th>Device</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Last Used</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id}>
              <td className="font-mono text-xs">{sub.username || sub.user_id.slice(0, 8)}</td>
              <td className="max-w-[150px] truncate text-xs">{sub.device_name || 'Unknown'}</td>
              <td>
                <span className="badge badge-ghost badge-sm">{sub.platform}</span>
              </td>
              <td>
                {sub.is_active ? (
                  <span className="badge badge-success badge-sm gap-1">
                    <LuCheck className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="badge badge-error badge-sm gap-1">
                    <LuCircleX className="h-3 w-3" /> Inactive
                  </span>
                )}
              </td>
              <td className="text-base-content/60 text-xs">
                {sub.last_used_at ? formatRelative(sub.last_used_at) : 'Never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function NotificationsPage() {
  const [debugExpanded, setDebugExpanded] = useState(true)

  const {
    data: notifStats,
    isLoading: notifLoading,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['admin', 'notifications', 'stats'],
    queryFn: fetchNotificationStats
  })

  const {
    data: pushStats,
    isLoading: pushLoading,
    refetch: refetchPush
  } = useQuery({
    queryKey: ['admin', 'push', 'stats'],
    queryFn: fetchPushStats
  })

  const {
    data: emailStats,
    isLoading: emailLoading,
    refetch: refetchEmail
  } = useQuery({
    queryKey: ['admin', 'email', 'stats'],
    queryFn: fetchEmailStats
  })

  // Push debugging queries
  const {
    data: pushGatewayHealth,
    isLoading: gatewayLoading,
    refetch: refetchGateway
  } = useQuery({
    queryKey: ['admin', 'push', 'gateway-health'],
    queryFn: checkPushGatewayHealth,
    refetchInterval: 30000 // Check every 30s
  })

  const {
    data: emailGatewayHealth,
    isLoading: emailGatewayLoading,
    refetch: refetchEmailGateway
  } = useQuery({
    queryKey: ['admin', 'email', 'gateway-health'],
    queryFn: checkEmailGatewayHealth,
    refetchInterval: 30000
  })

  const {
    data: pipelineStats,
    isLoading: pipelineLoading,
    refetch: refetchPipeline
  } = useQuery({
    queryKey: ['admin', 'push', 'pipeline-stats'],
    queryFn: fetchPushPipelineStats
  })

  const {
    data: failedSubs,
    isLoading: failedSubsLoading,
    refetch: refetchFailedSubs
  } = useQuery({
    queryKey: ['admin', 'push', 'failed-subscriptions'],
    queryFn: () => fetchFailedPushSubscriptions(10)
  })

  const {
    data: recentActivity,
    isLoading: recentActivityLoading,
    refetch: refetchRecentActivity
  } = useQuery({
    queryKey: ['admin', 'push', 'recent-activity'],
    queryFn: () => fetchRecentPushActivity(10)
  })

  // Real-time subscription to notification-related tables
  const handleRealtimeChange = useCallback(() => {
    refetch()
    refetchPush()
    refetchEmail()
    refetchPipeline()
    refetchFailedSubs()
    refetchRecentActivity()
  }, [
    refetch,
    refetchPush,
    refetchEmail,
    refetchPipeline,
    refetchFailedSubs,
    refetchRecentActivity
  ])

  useMultiTableSubscription(
    ['notifications', 'push_subscriptions', 'email_queue'],
    handleRealtimeChange
  )

  const loading = notifLoading || pushLoading || emailLoading
  const debugLoading =
    gatewayLoading || pipelineLoading || failedSubsLoading || recentActivityLoading

  const notificationTypes = ['mention', 'reply', 'message', 'reaction', 'channel_event']

  const refreshAll = () => {
    refetch()
    refetchPush()
    refetchEmail()
    refetchGateway()
    refetchEmailGateway()
    refetchPipeline()
    refetchFailedSubs()
    refetchRecentActivity()
  }

  return (
    <>
      <Head>
        <title>Notifications | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Notifications"
          subtitle={
            <span className="flex items-center gap-2">
              Notification, push, and email statistics
              <span className="badge badge-success badge-xs gap-1">
                <LuRadio className="h-3 w-3" /> Live
              </span>
            </span>
          }
          onRefresh={refreshAll}
          refreshing={isRefetching}
        />

        <div className="space-y-6 p-6">
          {/* Gateway Health Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Push Gateway Health */}
            <div className="bg-base-100 rounded-box border-base-300 flex items-center justify-between border p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${pushGatewayHealth?.status === 'healthy' ? 'bg-success/10' : pushGatewayHealth?.status === 'degraded' ? 'bg-warning/10' : 'bg-error/10'}`}>
                  <LuServer
                    className={`h-5 w-5 ${pushGatewayHealth?.status === 'healthy' ? 'text-success' : pushGatewayHealth?.status === 'degraded' ? 'text-warning' : 'text-error'}`}
                  />
                </div>
                <div>
                  <p className="font-medium">Push Gateway</p>
                  <p className="text-base-content/60 text-xs">
                    {gatewayLoading
                      ? 'Checking...'
                      : pushGatewayHealth?.error || `${pushGatewayHealth?.latency}ms`}
                  </p>
                </div>
              </div>
              <StatusBadge status={pushGatewayHealth?.status || 'down'} />
            </div>

            {/* Email Gateway Health */}
            <div className="bg-base-100 rounded-box border-base-300 flex items-center justify-between border p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${emailGatewayHealth?.status === 'healthy' ? 'bg-success/10' : emailGatewayHealth?.status === 'degraded' ? 'bg-warning/10' : 'bg-error/10'}`}>
                  <LuMail
                    className={`h-5 w-5 ${emailGatewayHealth?.status === 'healthy' ? 'text-success' : emailGatewayHealth?.status === 'degraded' ? 'text-warning' : 'text-error'}`}
                  />
                </div>
                <div>
                  <p className="font-medium">Email Gateway</p>
                  <p className="text-base-content/60 text-xs">
                    {emailGatewayLoading
                      ? 'Checking...'
                      : emailGatewayHealth?.error ||
                        `${emailGatewayHealth?.provider || 'No provider'} • ${emailGatewayHealth?.latency}ms`}
                  </p>
                </div>
              </div>
              <StatusBadge status={emailGatewayHealth?.status || 'down'} />
            </div>
          </div>

          {/* Push Pipeline Visualization */}
          <PushPipelineFlow
            pipeline={pipelineStats || null}
            gatewayHealth={pushGatewayHealth || null}
          />

          {/* Main Notification Stats */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">In-App Notifications</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatCard
                title="Total Notifications"
                value={notifStats?.total ?? 0}
                icon={<LuBell className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Unread"
                value={notifStats?.unread ?? 0}
                icon={<LuBellOff className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Read Rate"
                value={`${notifStats?.readRate ?? 0}%`}
                icon={<LuCheck className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Mentions"
                value={notifStats?.byType?.mention ?? 0}
                loading={loading}
              />
            </div>
          </div>

          {/* Notification by Type */}
          <div className="bg-base-100 rounded-box border-base-300 border p-5">
            <h2 className="mb-4 text-lg font-semibold">By Type</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {notificationTypes.map((type) => (
                <div key={type} className="text-center">
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <span className="skeleton inline-block h-7 w-12" />
                    ) : (
                      (notifStats?.byType?.[type] ?? 0).toLocaleString()
                    )}
                  </p>
                  <p className="text-base-content/60 text-sm capitalize">
                    {type.replace('_', ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Push Notifications */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Push Notifications</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatCard
                title="Active Subscriptions"
                value={pushStats?.active ?? 0}
                icon={<LuSmartphone className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Failed Deliveries"
                value={pushStats?.failed ?? 0}
                icon={<LuCircleAlert className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Queue Pending"
                value={pushGatewayHealth?.pendingJobs ?? 0}
                icon={<LuClock className="h-6 w-6" />}
                loading={gatewayLoading}
              />
              <StatCard
                title="Success Rate"
                value={
                  pushStats && pushStats.active > 0
                    ? `${Math.round(((pushStats.active - pushStats.failed) / pushStats.active) * 100)}%`
                    : '100%'
                }
                loading={loading}
              />
            </div>
          </div>

          {/* Email Notifications */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Email Queue</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatCard
                title="Pending"
                value={emailStats?.pending ?? 0}
                icon={<LuClock className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Sent"
                value={emailStats?.sent ?? 0}
                icon={<LuMail className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Failed"
                value={emailStats?.failed ?? 0}
                icon={<LuCircleAlert className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Queue Pending"
                value={emailGatewayHealth?.pendingJobs ?? 0}
                icon={<LuClock className="h-6 w-6" />}
                loading={emailGatewayLoading}
              />
            </div>
          </div>

          {/* Debug Section - Collapsible */}
          <div className="bg-base-100 rounded-box border-base-300 border">
            <button
              onClick={() => setDebugExpanded(!debugExpanded)}
              className="flex w-full items-center justify-between p-5">
              <div className="flex items-center gap-2">
                <LuRefreshCw className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Push Debugging</h2>
                {debugLoading && <span className="loading loading-spinner loading-xs" />}
              </div>
              {debugExpanded ? (
                <LuChevronUp className="h-5 w-5" />
              ) : (
                <LuChevronDown className="h-5 w-5" />
              )}
            </button>

            {debugExpanded && (
              <div className="space-y-6 border-t p-5">
                {/* Pipeline Config Details */}
                <CollapsibleSection title="Pipeline Configuration" defaultOpen>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-base-content/60 text-sm">Queue Depth</span>
                        <code className="bg-base-200 rounded px-2 py-1 text-xs">
                          {pipelineStats?.queueDepth ?? 0}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base-content/60 text-sm">Trigger Configured</span>
                        <StatusBadge status={pipelineStats?.triggerConfigured ? 'ok' : 'error'} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base-content/60 text-sm">Messages Processed</span>
                        <code className="bg-base-200 rounded px-2 py-1 text-xs">
                          {pipelineStats?.messagesProcessed ?? 0}
                        </code>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-base-content/60 text-sm">VAPID Configured</span>
                        <StatusBadge status={pushGatewayHealth?.vapidConfigured ? 'ok' : 'error'} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base-content/60 text-sm">Queue Connected</span>
                        <StatusBadge status={pushGatewayHealth?.queueConnected ? 'ok' : 'error'} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base-content/60 text-sm">Last Push Sent</span>
                        <span className="text-xs">
                          {pipelineStats?.lastPushSent
                            ? formatRelative(pipelineStats.lastPushSent)
                            : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Failed Subscriptions */}
                <CollapsibleSection
                  title={`Failed Subscriptions (${failedSubs?.length ?? 0})`}
                  defaultOpen={false}>
                  <FailedSubscriptionsTable subscriptions={failedSubs || []} />
                </CollapsibleSection>

                {/* Recent Activity */}
                <CollapsibleSection
                  title={`Recent Push Activity (${recentActivity?.length ?? 0})`}
                  defaultOpen={false}>
                  <RecentActivityTable subscriptions={recentActivity || []} />
                </CollapsibleSection>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </>
  )
}
