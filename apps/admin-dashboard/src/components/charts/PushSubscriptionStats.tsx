import { useQuery } from '@tanstack/react-query'
import {
  LuApple,
  LuChrome,
  LuClock,
  LuMonitor,
  LuRefreshCw,
  LuShield,
  LuSmartphone,
  LuTrendingDown,
  LuTrendingUp,
  LuTriangleAlert
} from 'react-icons/lu'

import { fetchPushSubscriptionAnalytics } from '@/services/supabase'
import type { PushSubscriptionAnalytics } from '@/types'

// Progress bar component for platform/health breakdown
function ProgressBar({
  label,
  value,
  total,
  color,
  icon: Icon
}: {
  label: string
  value: number
  total: number
  color: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="h-4 w-4" />}
          {label}
        </span>
        <span className="font-mono">
          {value.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="bg-base-300 h-2 w-full overflow-hidden rounded-full">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Stat card for lifecycle metrics
function MiniStat({
  label,
  value,
  trend,
  icon: Icon
}: {
  label: string
  value: number
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-base-200/50 flex items-center gap-3 rounded-lg p-3">
      {Icon && (
        <div className="bg-base-300 rounded-lg p-2">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-base-content/60 flex items-center gap-1 text-xs">
          {trend === 'up' && <LuTrendingUp className="text-success h-3 w-3" />}
          {trend === 'down' && <LuTrendingDown className="text-error h-3 w-3" />}
          {label}
        </p>
      </div>
    </div>
  )
}

export function PushSubscriptionStats() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'push', 'analytics'],
    queryFn: fetchPushSubscriptionAnalytics,
    staleTime: 60000 // 1 minute
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
          <div className="skeleton h-32" />
        </div>
      </div>
    )
  }

  const analytics = data as PushSubscriptionAnalytics

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Push Subscription Analytics</h2>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="btn btn-ghost btn-sm gap-1">
          <LuRefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Platform Breakdown */}
        <div className="bg-base-100 rounded-box border-base-300 border p-4">
          <h3 className="mb-4 flex items-center gap-2 font-medium">
            <LuSmartphone className="h-4 w-4" />
            Platform Distribution
          </h3>
          <div className="space-y-3">
            <ProgressBar
              label="Web"
              value={analytics.platforms.web}
              total={analytics.platforms.total}
              color="bg-primary"
              icon={LuChrome}
            />
            <ProgressBar
              label="iOS PWA"
              value={analytics.platforms.ios}
              total={analytics.platforms.total}
              color="bg-secondary"
              icon={LuApple}
            />
            <ProgressBar
              label="Android"
              value={analytics.platforms.android}
              total={analytics.platforms.total}
              color="bg-accent"
              icon={LuSmartphone}
            />
            {analytics.platforms.desktop > 0 && (
              <ProgressBar
                label="Desktop"
                value={analytics.platforms.desktop}
                total={analytics.platforms.total}
                color="bg-info"
                icon={LuMonitor}
              />
            )}
          </div>
          <div className="text-base-content/60 mt-3 border-t pt-3 text-center text-sm">
            Total: <span className="font-semibold">{analytics.platforms.total}</span> active
            subscriptions
          </div>
        </div>

        {/* Subscription Health */}
        <div className="bg-base-100 rounded-box border-base-300 border p-4">
          <h3 className="mb-4 flex items-center gap-2 font-medium">
            <LuShield className="h-4 w-4" />
            Subscription Health
          </h3>
          <div className="space-y-3">
            <ProgressBar
              label="Fresh (< 7d)"
              value={analytics.health.fresh}
              total={analytics.platforms.total}
              color="bg-success"
            />
            <ProgressBar
              label="OK (7-30d)"
              value={analytics.health.ok}
              total={analytics.platforms.total}
              color="bg-warning"
            />
            <ProgressBar
              label="Stale (> 30d)"
              value={analytics.health.stale}
              total={analytics.platforms.total}
              color="bg-error"
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-base-content/60 flex items-center gap-1">
              <LuClock className="h-4 w-4" />
              Avg age
            </span>
            <span className="font-mono font-semibold">{analytics.health.avgAgeDays} days</span>
          </div>
          {analytics.health.stale > 0 && (
            <div className="bg-error/10 text-error mt-2 flex items-center gap-2 rounded-lg p-2 text-xs">
              <LuTriangleAlert className="h-4 w-4 shrink-0" />
              {analytics.health.stale} subscriptions need refresh
            </div>
          )}
        </div>

        {/* Lifecycle & Errors */}
        <div className="bg-base-100 rounded-box border-base-300 space-y-4 border p-4">
          <h3 className="flex items-center gap-2 font-medium">
            <LuTrendingUp className="h-4 w-4" />
            Lifecycle (7 days)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="New" value={analytics.lifecycle.newThisWeek} trend="up" />
            <MiniStat label="Churned" value={analytics.lifecycle.churnedThisWeek} trend="down" />
          </div>

          {/* Error Breakdown */}
          {analytics.errors.total > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-base-content/70 mb-2 flex items-center gap-2 text-sm font-medium">
                <LuTriangleAlert className="h-4 w-4" />
                Errors ({analytics.errors.total})
              </h4>
              <div className="space-y-1">
                {Object.entries(analytics.errors.byType)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <code className="bg-error/10 text-error rounded px-1.5 py-0.5">{type}</code>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
