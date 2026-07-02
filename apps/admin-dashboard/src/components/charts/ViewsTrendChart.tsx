import type { ViewsTrendPoint } from '@/types'

import { TrendAreaChart } from './TrendAreaChart'

interface ViewsTrendChartProps {
  data: ViewsTrendPoint[]
  loading?: boolean
  height?: number
}

export function ViewsTrendChart({ data, loading, height }: ViewsTrendChartProps) {
  return (
    <TrendAreaChart
      data={data}
      xKey="view_date"
      series={[
        {
          yKey: 'views',
          label: 'Total Views',
          color: 'var(--color-primary)',
          gradientId: 'colorViews'
        },
        {
          yKey: 'unique_visitors',
          label: 'Unique Visitors',
          color: 'var(--color-secondary)',
          gradientId: 'colorUnique'
        }
      ]}
      emptyMessage="No view data available yet"
      loading={loading}
      height={height}
    />
  )
}
