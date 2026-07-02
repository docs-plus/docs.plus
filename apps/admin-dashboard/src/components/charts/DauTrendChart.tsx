import type { DauTrendPoint } from '@/types'

import { TrendAreaChart } from './TrendAreaChart'

interface DauTrendChartProps {
  data: DauTrendPoint[]
  loading?: boolean
  height?: number
}

export function DauTrendChart({ data, loading, height }: DauTrendChartProps) {
  return (
    <TrendAreaChart
      data={data}
      xKey="activity_date"
      series={[
        {
          yKey: 'active_users',
          label: 'Active Users',
          color: 'var(--color-primary)',
          gradientId: 'colorDau'
        }
      ]}
      emptyMessage="No activity data available yet"
      loading={loading}
      height={height}
    />
  )
}
