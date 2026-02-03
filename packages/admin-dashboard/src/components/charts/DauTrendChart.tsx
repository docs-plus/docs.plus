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

import type { DauTrendPoint } from '@/types'

interface DauTrendChartProps {
  data: DauTrendPoint[]
  loading?: boolean
  height?: number
}

export function DauTrendChart({ data, loading, height = 300 }: DauTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      date: format(parseISO(point.activity_date), 'MMM d'),
      fullDate: format(parseISO(point.activity_date), 'MMM d, yyyy')
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
        No activity data available yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorDau" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(var(--p))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(var(--p))" stopOpacity={0} />
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
          formatter={(value) => [(value as number).toLocaleString(), 'Active Users']}
        />
        <Area
          type="monotone"
          dataKey="active_users"
          name="Active Users"
          stroke="oklch(var(--p))"
          fillOpacity={1}
          fill="url(#colorDau)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
