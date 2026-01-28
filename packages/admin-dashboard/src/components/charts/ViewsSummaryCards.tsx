import { LuEye, LuUsers, LuMonitor, LuSmartphone, LuTablet, LuTrendingUp } from 'react-icons/lu'
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
      icon: LuEye,
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      label: 'Unique Visitors',
      value: data?.unique_visitors ?? 0,
      icon: LuUsers,
      color: 'text-secondary',
      bg: 'bg-secondary/10'
    },
    {
      label: 'Views Today',
      value: data?.views_today ?? 0,
      icon: LuTrendingUp,
      color: 'text-success',
      bg: 'bg-success/10'
    },
    {
      label: 'Bounce Rate',
      value: data ? `${Math.round((data.bounce_rate ?? 0) * 100)}%` : '0%',
      icon: LuTrendingUp,
      color: 'text-warning',
      bg: 'bg-warning/10',
      isPercent: true
    }
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-base-100 rounded-box border-base-300 border p-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${stat.bg}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-base-content/60 text-xs">{stat.label}</p>
              {loading ? (
                <div className="skeleton mt-1 h-6 w-16" />
              ) : (
                <p className="text-xl font-bold">
                  {stat.isPercent ? stat.value : (stat.value as number).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface DeviceBreakdownProps {
  data: ViewsSummary | undefined
  loading?: boolean
}

export function DeviceBreakdown({ data, loading }: DeviceBreakdownProps) {
  const devices = [
    { label: 'Desktop', value: data?.devices?.desktop ?? 0, icon: LuMonitor },
    { label: 'Mobile', value: data?.devices?.mobile ?? 0, icon: LuSmartphone },
    { label: 'Tablet', value: data?.devices?.tablet ?? 0, icon: LuTablet }
  ]

  const total = devices.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="space-y-3">
      {devices.map((device) => {
        const percentage = total > 0 ? Math.round((device.value / total) * 100) : 0
        return (
          <div key={device.label} className="flex items-center gap-3">
            <device.icon className="text-base-content/60 h-5 w-5" />
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{device.label}</span>
                {loading ? (
                  <span className="skeleton h-4 w-12" />
                ) : (
                  <span className="font-medium">
                    {device.value.toLocaleString()} ({percentage}%)
                  </span>
                )}
              </div>
              <div className="bg-base-200 h-2 w-full rounded-full">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
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

interface UserTypeBreakdownProps {
  data: ViewsSummary | undefined
  loading?: boolean
}

export function UserTypeBreakdown({ data, loading }: UserTypeBreakdownProps) {
  const userTypes = [
    { label: 'Authenticated', value: data?.user_types?.authenticated ?? 0, color: 'bg-success' },
    { label: 'Anonymous', value: data?.user_types?.anonymous ?? 0, color: 'bg-warning' },
    { label: 'Guest', value: data?.user_types?.guest ?? 0, color: 'bg-info' }
  ]

  const total = userTypes.reduce((sum, t) => sum + t.value, 0)

  return (
    <div className="space-y-3">
      {userTypes.map((type) => {
        const percentage = total > 0 ? Math.round((type.value / total) * 100) : 0
        return (
          <div key={type.label} className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${type.color}`} />
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{type.label}</span>
                {loading ? (
                  <span className="skeleton h-4 w-12" />
                ) : (
                  <span className="font-medium">
                    {type.value.toLocaleString()} ({percentage}%)
                  </span>
                )}
              </div>
              <div className="bg-base-200 h-2 w-full rounded-full">
                <div
                  className={`${type.color} h-2 rounded-full transition-all duration-300`}
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
