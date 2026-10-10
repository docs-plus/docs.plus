import { useQuery } from '@tanstack/react-query'
import type { IconType } from 'react-icons'
import {
  LuApple,
  LuChrome,
  LuCircleAlert,
  LuClock,
  LuMonitor,
  LuRefreshCw,
  LuShield,
  LuSmartphone,
  LuTrendingDown,
  LuTrendingUp,
  LuTriangleAlert
} from 'react-icons/lu'

import { SectionCard } from '@/components/cards/SectionCard'
import { fetchPushSubscriptionAnalytics } from '@/services/api'

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
  icon?: IconType
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="h-4 w-4" />}
          {label}
        </span>
        <span className="tabular-nums">
          {value.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="bg-base-300 h-2 w-full overflow-hidden rounded-full">
        <div className={`h-full ${color} transition-[width]`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MiniStat({ label, value, trend }: { label: string; value: number; trend: 'up' | 'down' }) {
  return (
    <div className="bg-base-200/50 rounded-field flex items-center gap-3 p-3">
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-base-content/60 flex items-center gap-1 text-xs">
          {trend === 'up' && <LuTrendingUp className="h-3 w-3 text-[var(--success-ink)]" />}
          {trend === 'down' && <LuTrendingDown className="h-3 w-3 text-[var(--error-ink)]" />}
          {label}
        </p>
      </div>
    </div>
  )
}

export function PushSubscriptionStats() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'push', 'analytics'],
    queryFn: fetchPushSubscriptionAnalytics,
    staleTime: 60000 // 1 minute
  })

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">Push Subscription Analytics</h2>
      <button
        onClick={() => refetch()}
        disabled={isRefetching || !data}
        className="btn btn-ghost btn-sm gap-1">
        <LuRefreshCw className={`h-4 w-4 ${isRefetching ? 'motion-safe:animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  )

  if (isError && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div role="alert" className="alert alert-error">
          <LuCircleAlert className="h-5 w-5" />
          <span>
            {error instanceof Error ? error.message : 'Failed to load push subscription analytics.'}
          </span>
          <button onClick={() => refetch()} disabled={isRefetching} className="btn btn-sm">
            {isRefetching && <span className="loading loading-spinner loading-xs" />}
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !data) {
    // Base-case card heights: 239px for the bar cards, 146px for Lifecycle until the lg row stretches it.
    // The optional rows (Desktop, stale warning, errors) make a loaded card taller.
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="skeleton rounded-box h-[239px]" />
          <div className="skeleton rounded-box h-[239px]" />
          <div className="skeleton rounded-box h-[146px] lg:h-[239px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard className="p-4">
          <h3 className="mb-4 flex items-center gap-2 font-medium">
            <LuSmartphone className="h-4 w-4" />
            Platform Distribution
          </h3>
          <div className="space-y-3">
            <ProgressBar
              label="Web"
              value={data.platforms.web}
              total={data.platforms.total}
              color="bg-primary"
              icon={LuChrome}
            />
            <ProgressBar
              label="iOS PWA"
              value={data.platforms.ios}
              total={data.platforms.total}
              color="bg-secondary"
              icon={LuApple}
            />
            <ProgressBar
              label="Android"
              value={data.platforms.android}
              total={data.platforms.total}
              color="bg-accent"
              icon={LuSmartphone}
            />
            {data.platforms.desktop > 0 && (
              <ProgressBar
                label="Desktop"
                value={data.platforms.desktop}
                total={data.platforms.total}
                color="bg-info"
                icon={LuMonitor}
              />
            )}
          </div>
          <div className="text-base-content/60 border-base-300 mt-3 border-t pt-3 text-center text-sm">
            Total: <span className="font-semibold">{data.platforms.total}</span> active
            subscriptions
          </div>
        </SectionCard>

        <SectionCard className="p-4">
          <h3 className="mb-4 flex items-center gap-2 font-medium">
            <LuShield className="h-4 w-4" />
            Subscription Health
          </h3>
          <div className="space-y-3">
            <ProgressBar
              label="Fresh (< 7d)"
              value={data.health.fresh}
              total={data.platforms.total}
              color="bg-success"
            />
            <ProgressBar
              label="OK (7-30d)"
              value={data.health.ok}
              total={data.platforms.total}
              color="bg-warning"
            />
            <ProgressBar
              label="Stale (> 30d)"
              value={data.health.stale}
              total={data.platforms.total}
              color="bg-error"
            />
          </div>
          <div className="border-base-300 mt-3 flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-base-content/60 flex items-center gap-1">
              <LuClock className="h-4 w-4" />
              Avg age
            </span>
            <span className="font-semibold tabular-nums">{data.health.avgAgeDays} days</span>
          </div>
          {data.health.stale > 0 && (
            <div className="bg-error/10 rounded-field mt-2 flex items-center gap-2 p-2 text-xs text-[var(--error-ink)]">
              <LuTriangleAlert className="h-4 w-4 shrink-0" />
              {data.health.stale} subscriptions need refresh
            </div>
          )}
        </SectionCard>

        <SectionCard className="space-y-4 p-4">
          <h3 className="flex items-center gap-2 font-medium">
            <LuTrendingUp className="h-4 w-4" />
            Lifecycle (7 days)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="New" value={data.lifecycle.newThisWeek} trend="up" />
            <MiniStat label="Churned" value={data.lifecycle.churnedThisWeek} trend="down" />
          </div>

          {data.errors.total > 0 && (
            <div className="border-base-300 border-t pt-4">
              <h4 className="text-base-content/70 mb-2 flex items-center gap-2 text-sm font-medium">
                <LuTriangleAlert className="h-4 w-4" />
                Errors ({data.errors.total})
              </h4>
              <div className="space-y-1">
                {Object.entries(data.errors.byType)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <code className="bg-error/10 rounded-field px-1.5 py-0.5 text-[var(--error-ink)]">
                        {type}
                      </code>
                      <span className="tabular-nums">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
