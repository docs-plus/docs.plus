import { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
  strokeColor?: string
  fillColor?: string
}

/**
 * Minimal sparkline chart for inline display
 * Shows trend without axes or labels
 */
export function Sparkline({
  data,
  width = 60,
  height = 20,
  className = '',
  strokeColor = 'currentColor',
  fillColor
}: SparklineProps) {
  // Calculate points once, derive both paths
  const { linePath, areaPath } = useMemo(() => {
    if (!data.length) return { linePath: '', areaPath: '' }

    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1

    const points = data.map((value, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })

    const pointsStr = points.join(' L ')
    return {
      linePath: `M ${pointsStr}`,
      areaPath: fillColor ? `M 0,${height} L ${pointsStr} L ${width},${height} Z` : ''
    }
  }, [data, width, height, fillColor])

  if (!data.length) {
    return (
      <div
        className={`text-base-content/30 flex items-center justify-center text-xs ${className}`}
        style={{ width, height }}>
        —
      </div>
    )
  }

  return (
    <svg width={width} height={height} className={className}>
      {areaPath && <path d={areaPath} fill={fillColor} fillOpacity={0.2} />}
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}
