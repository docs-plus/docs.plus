/**
 * StatCard Component
 * ===================
 * Displays a statistic with trend indicator.
 */

import { MdTrendingUp, MdTrendingDown } from 'react-icons/md'

interface StatCardProps {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: React.ComponentType<{ size?: number; className?: string }>
  accent?: boolean
  delay?: number
}

export const StatCard = ({
  title,
  value,
  change,
  trend,
  icon: Icon,
  accent,
  delay = 0
}: StatCardProps) => (
  <div
    className={`card border-base-300 border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${accent ? 'bg-primary text-primary-content' : 'bg-base-100'}`}
    style={{ animationDelay: `${delay}ms` }}>
    <div className="card-body p-4">
      <div className="flex items-start justify-between">
        <div
          className={`flex size-10 items-center justify-center rounded-xl transition-transform hover:scale-110 ${accent ? 'bg-primary-content/20' : 'bg-base-200'}`}>
          <Icon
            size={20}
            className={accent ? 'text-primary-content' : 'text-primary'}
            aria-hidden="true"
          />
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-success' : 'text-error'}`}>
          {trend === 'up' ? (
            <MdTrendingUp size={14} aria-hidden="true" />
          ) : (
            <MdTrendingDown size={14} aria-hidden="true" />
          )}
          {change}
        </span>
      </div>
      <div className="mt-3">
        <p className={`text-2xl font-bold ${accent ? '' : 'text-base-content'}`}>{value}</p>
        <p className={`text-sm ${accent ? 'text-primary-content/70' : 'text-base-content/60'}`}>
          {title}
        </p>
      </div>
    </div>
  </div>
)
