import { LuActivity, LuUsers } from 'react-icons/lu'

import { StatCard } from '@/components/cards/StatCard'
import type { RetentionMetrics } from '@/types'

interface RetentionCardsProps {
  data: RetentionMetrics | undefined
  loading?: boolean
}

// StatCard prints its own sign, so the trend carries the magnitude only.
function changeTrend(change: number) {
  return {
    value: `${Math.abs(change)}%`,
    label: 'vs prev',
    direction: change > 0 ? ('up' as const) : change < 0 ? ('down' as const) : ('neutral' as const)
  }
}

export function RetentionCards({ data, loading }: RetentionCardsProps) {
  const cards = [
    {
      label: 'DAU',
      sublabel: 'Daily Active Users',
      value: data?.dau ?? 0,
      change: data?.dau_change_pct ?? 0,
      icon: LuUsers
    },
    {
      label: 'WAU',
      sublabel: 'Weekly Active Users',
      value: data?.wau ?? 0,
      change: data?.wau_change_pct ?? 0,
      icon: LuUsers
    },
    {
      label: 'MAU',
      sublabel: 'Monthly Active Users',
      value: data?.mau ?? 0,
      change: data?.mau_change_pct ?? 0,
      icon: LuUsers
    },
    {
      label: 'Stickiness',
      sublabel: 'DAU/MAU Ratio',
      value: `${data?.stickiness ?? 0}%`,
      change: null,
      icon: LuActivity
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          title={card.label}
          value={card.value}
          description={card.sublabel}
          icon={<card.icon className="h-6 w-6" />}
          trend={card.change !== null ? changeTrend(card.change) : undefined}
          loading={loading}
        />
      ))}
    </div>
  )
}
