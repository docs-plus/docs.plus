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

export interface TrendAreaSeries<T> {
  yKey: keyof T & string
  label: string
  color: string
  gradientId: string
}

interface TrendAreaChartProps<T> {
  data: T[]
  xKey: keyof T & string
  series: TrendAreaSeries<T>[]
  emptyMessage: string
  loading?: boolean
  height?: number
}

export function TrendAreaChart<T extends object>({
  data,
  xKey,
  series,
  emptyMessage,
  loading,
  height = 300
}: TrendAreaChartProps<T>) {
  const chartData = useMemo(() => {
    return data.map((point) => {
      const day = parseISO(String(point[xKey]))
      return {
        ...point,
        date: format(day, 'MMM d'),
        fullDate: format(day, 'MMM d, yyyy')
      }
    })
  }, [data, xKey])

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
        {emptyMessage}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
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
            backgroundColor: 'var(--color-base-100)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '0.5rem',
            fontSize: '0.875rem'
          }}
          labelFormatter={(_, payload) => payload[0]?.payload?.fullDate || ''}
          {...(series.length === 1 && {
            formatter: (value: unknown) => [(value as number).toLocaleString(), series[0].label]
          })}
        />
        {series.map((s) => (
          <Area
            key={s.yKey}
            type="monotone"
            dataKey={s.yKey as never}
            name={s.label}
            stroke={s.color}
            fillOpacity={1}
            fill={`url(#${s.gradientId})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
