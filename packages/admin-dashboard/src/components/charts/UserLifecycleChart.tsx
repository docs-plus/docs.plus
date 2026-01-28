import { LuUserPlus, LuUserCheck, LuUserX, LuTriangleAlert } from 'react-icons/lu'
import type { UserLifecycleSegments } from '@/types'

interface UserLifecycleChartProps {
  data: UserLifecycleSegments | undefined
  loading?: boolean
}

export function UserLifecycleChart({ data, loading }: UserLifecycleChartProps) {
  const segments = [
    {
      label: 'New',
      description: 'Joined < 7 days',
      value: data?.new ?? 0,
      pct: data?.new_pct ?? 0,
      icon: LuUserPlus,
      color: 'bg-success',
      textColor: 'text-success'
    },
    {
      label: 'Active',
      description: 'Online < 7 days',
      value: data?.active ?? 0,
      pct: data?.active_pct ?? 0,
      icon: LuUserCheck,
      color: 'bg-primary',
      textColor: 'text-primary'
    },
    {
      label: 'At Risk',
      description: 'Inactive 14-30 days',
      value: data?.at_risk ?? 0,
      pct: data?.at_risk_pct ?? 0,
      icon: LuTriangleAlert,
      color: 'bg-warning',
      textColor: 'text-warning'
    },
    {
      label: 'Churned',
      description: 'Inactive > 30 days',
      value: data?.churned ?? 0,
      pct: data?.churned_pct ?? 0,
      icon: LuUserX,
      color: 'bg-error',
      textColor: 'text-error'
    }
  ]

  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="bg-base-200 flex h-4 w-full overflow-hidden rounded-full">
        {!loading &&
          segments.map((segment) => (
            <div
              key={segment.label}
              className={`${segment.color} transition-all duration-300`}
              style={{ width: `${segment.pct}%` }}
              title={`${segment.label}: ${segment.value} (${segment.pct}%)`}
            />
          ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${segment.color}`} />
            <div>
              <p className="flex items-center gap-1 text-sm font-medium">
                <segment.icon className={`h-3 w-3 ${segment.textColor}`} />
                {segment.label}
              </p>
              {loading ? (
                <div className="skeleton h-4 w-16" />
              ) : (
                <p className="text-base-content/60 text-xs">
                  {segment.value.toLocaleString()} ({segment.pct}%)
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      {!loading && (
        <div className="text-base-content/60 text-center text-sm">
          Total Users: {total.toLocaleString()}
        </div>
      )}
    </div>
  )
}
