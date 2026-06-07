import { format, parseISO } from 'date-fns'
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { ViewsTrendPoint } from '@/types'

interface ViewsTrendChartProps {
  data: ViewsTrendPoint[]
  loading?: boolean
  height?: number
}

export function ViewsTrendChart({ data, loading, height = 300 }: ViewsTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      date: format(parseISO(point.view_date), 'MMM d'),
      fullDate: format(parseISO(point.view_date), 'MMM d, yyyy')
    }))
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="text-base-content/50 flex items-center justify-center" style={{ height }}>
        No view data available yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(var(--p))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(var(--p))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(var(--s))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(var(--s))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-base-300" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="fill-base-content/60"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          className="fill-base-content/60"
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'oklch(var(--b1))',
            border: '1px solid oklch(var(--b3))',
            borderRadius: '0.5rem',
            fontSize: '0.875rem'
          }}
          labelFormatter={(_, payload) => payload[0]?.payload?.fullDate || ''}
        />
        <Area
          type="monotone"
          dataKey="views"
          name="Total Views"
          stroke="oklch(var(--p))"
          fillOpacity={1}
          fill="url(#colorViews)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="unique_sessions"
          name="Unique Sessions"
          stroke="oklch(var(--s))"
          fillOpacity={1}
          fill="url(#colorUnique)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
