import { ReactNode } from 'react'
import { LuTrendingUp, LuTrendingDown } from 'react-icons/lu'
import { clsx } from 'clsx'

interface StatCardProps {
  title: string
  value: number | string
  icon?: ReactNode
  trend?: {
    value: number
    label: string
    direction: 'up' | 'down' | 'neutral'
  }
  loading?: boolean
  className?: string
}

export function StatCard({ title, value, icon, trend, loading, className }: StatCardProps) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value

  return (
    <div className={clsx('bg-base-100 rounded-box border-base-300 border p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-base-content/60 mb-1 text-sm">{title}</p>
          {loading ? (
            <div className="skeleton h-8 w-24" />
          ) : (
            <p className="text-3xl font-bold">{formattedValue}</p>
          )}

          {trend && !loading && (
            <div
              className={clsx(
                'mt-2 flex items-center gap-1 text-sm',
                trend.direction === 'up' && 'text-success',
                trend.direction === 'down' && 'text-error',
                trend.direction === 'neutral' && 'text-base-content/60'
              )}>
              {trend.direction === 'up' && <LuTrendingUp className="h-4 w-4" />}
              {trend.direction === 'down' && <LuTrendingDown className="h-4 w-4" />}
              <span>
                {trend.direction !== 'neutral' && (trend.direction === 'up' ? '+' : '-')}
                {trend.value} {trend.label}
              </span>
            </div>
          )}
        </div>

        {icon && <div className="bg-primary/10 text-primary rounded-lg p-3">{icon}</div>}
      </div>
    </div>
  )
}
