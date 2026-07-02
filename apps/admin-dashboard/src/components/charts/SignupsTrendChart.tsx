import type { SignupsTrendPoint } from '@/types'

import { TrendAreaChart } from './TrendAreaChart'

interface SignupsTrendChartProps {
  data: SignupsTrendPoint[]
  loading?: boolean
  height?: number
}

export function SignupsTrendChart({ data, loading, height }: SignupsTrendChartProps) {
  return (
    <TrendAreaChart
      data={data}
      xKey="day"
      series={[
        {
          yKey: 'signups',
          label: 'Signups',
          color: 'var(--color-secondary)',
          gradientId: 'colorSignups'
        }
      ]}
      emptyMessage="No signup data available yet"
      loading={loading}
      height={height}
    />
  )
}
