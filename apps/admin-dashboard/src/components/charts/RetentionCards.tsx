import { LuActivity, LuTrendingDown, LuTrendingUp, LuUsers } from 'react-icons/lu'

import type { RetentionMetrics } from '@/types'

interface RetentionCardsProps {
  data: RetentionMetrics | undefined
  loading?: boolean
}

function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0
  const isNegative = value < 0

  return (
    <div
      className={`flex items-center gap-1 text-sm ${
        isPositive ? 'text-success' : isNegative ? 'text-error' : 'text-base-content/60'
      }`}>
      {isPositive && <LuTrendingUp className="h-4 w-4" />}
      {isNegative && <LuTrendingDown className="h-4 w-4" />}
      <span>
        {isPositive && '+'}
        {value}% {label}
      </span>
    </div>
  )
}

export function RetentionCards({ data, loading }: RetentionCardsProps) {
  const cards = [
    {
      label: 'DAU',
      sublabel: 'Daily Active Users',
      value: data?.dau ?? 0,
      change: data?.dau_change_pct ?? 0,
      icon: LuUsers,
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      label: 'WAU',
      sublabel: 'Weekly Active Users',
      value: data?.wau ?? 0,
      change: data?.wau_change_pct ?? 0,
      icon: LuUsers,
      color: 'text-secondary',
      bg: 'bg-secondary/10'
    },
    {
      label: 'MAU',
      sublabel: 'Monthly Active Users',
      value: data?.mau ?? 0,
      change: data?.mau_change_pct ?? 0,
      icon: LuUsers,
      color: 'text-accent',
      bg: 'bg-accent/10'
    },
    {
      label: 'Stickiness',
      sublabel: 'DAU/MAU Ratio',
      value: `${data?.stickiness ?? 0}%`,
      change: null,
      icon: LuActivity,
      color: 'text-success',
      bg: 'bg-success/10',
      isPercent: true
    }
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-base-100 rounded-box border-base-300 border p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-base-content/60 mb-1 text-xs">{card.label}</p>
              {loading ? (
                <div className="skeleton mb-1 h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">
                  {card.isPercent ? card.value : (card.value as number).toLocaleString()}
                </p>
              )}
              <p className="text-base-content/50 text-xs">{card.sublabel}</p>
              {card.change !== null && !loading && (
                <TrendIndicator value={card.change} label="vs prev" />
              )}
            </div>
            <div className={`rounded-lg p-2 ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
