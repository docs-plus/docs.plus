import type { ReactNode } from 'react'
import { LuEye, LuMonitor, LuSmartphone, LuTablet, LuTrendingUp, LuUsers } from 'react-icons/lu'

import { StatCard } from '@/components/cards/StatCard'
import type { ViewsSummary } from '@/types'

interface ViewsSummaryCardsProps {
  data: ViewsSummary | undefined
  loading?: boolean
}

export function ViewsSummaryCards({ data, loading }: ViewsSummaryCardsProps) {
  const stats = [
    {
      label: 'Total Views',
      value: data?.total_views ?? 0,
      icon: LuEye
    },
    {
      // Summed per-document distinct users, so a cross-document reader counts more than
      // once. The label is "Engaged Readers" to match that math, not "Unique Visitors",
      // which implies a true global distinct count.
      label: 'Engaged Readers',
      value: data?.unique_visitors ?? 0,
      icon: LuUsers
    },
    {
      label: 'Views Today',
      value: data?.views_today ?? 0,
      icon: LuTrendingUp
    },
    {
      label: 'Bounce Rate',
      value: data ? `${Math.round(data.bounce_rate ?? 0)}%` : '0%',
      icon: LuTrendingUp
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          title={stat.label}
          value={stat.value}
          icon={<stat.icon className="h-6 w-6" />}
          loading={loading}
        />
      ))}
    </div>
  )
}

interface ShareRow {
  label: string
  value: number
  lead: ReactNode
  fill: string
}

function ShareRows({ rows, loading }: { rows: ShareRow[]; loading?: boolean }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const percentage = total > 0 ? Math.round((row.value / total) * 100) : 0
        return (
          <div key={row.label} className="flex items-center gap-3">
            {row.lead}
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{row.label}</span>
                {loading ? (
                  <span className="skeleton h-4 w-12" />
                ) : (
                  <span className="font-medium">
                    {row.value.toLocaleString()} ({percentage}%)
                  </span>
                )}
              </div>
              <div className="bg-base-200 h-2 w-full rounded-full">
                <div
                  className={`${row.fill} h-2 rounded-full transition-[width] duration-300`}
                  style={{ width: loading ? '0%' : `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface BreakdownProps {
  data: ViewsSummary | undefined
  loading?: boolean
}

export function DeviceBreakdown({ data, loading }: BreakdownProps) {
  const devices = [
    { label: 'Desktop', value: data?.devices?.desktop ?? 0, Icon: LuMonitor },
    { label: 'Mobile', value: data?.devices?.mobile ?? 0, Icon: LuSmartphone },
    { label: 'Tablet', value: data?.devices?.tablet ?? 0, Icon: LuTablet }
  ]

  const rows = devices.map(({ label, value, Icon }) => ({
    label,
    value,
    lead: <Icon className="text-base-content/60 h-5 w-5" />,
    fill: 'bg-primary'
  }))
  return <ShareRows rows={rows} loading={loading} />
}

export function UserTypeBreakdown({ data, loading }: BreakdownProps) {
  const userTypes = [
    { label: 'Authenticated', value: data?.user_types?.authenticated ?? 0, color: 'bg-success' },
    { label: 'Anonymous', value: data?.user_types?.anonymous ?? 0, color: 'bg-warning' },
    { label: 'Guest', value: data?.user_types?.guest ?? 0, color: 'bg-info' }
  ]

  const rows = userTypes.map(({ label, value, color }) => ({
    label,
    value,
    lead: <div className={`h-3 w-3 rounded-full ${color}`} />,
    fill: color
  }))
  return <ShareRows rows={rows} loading={loading} />
}
