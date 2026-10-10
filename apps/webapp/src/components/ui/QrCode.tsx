import { twMerge } from '@utils/twMerge'
import { useMemo } from 'react'
import { encode } from 'uqr'

// ISO/IEC 18004 asks for a 4-module light margin; a smaller one must sit on a light surface.
const STANDARD_QUIET_ZONE = 4
const FINDER_SIZE = 7

const isFinder = (x: number, y: number, size: number) =>
  (x < FINDER_SIZE && y < FINDER_SIZE) ||
  (x >= size - FINDER_SIZE && y < FINDER_SIZE) ||
  (x < FINDER_SIZE && y >= size - FINDER_SIZE)

/** Round dots, bridged to dark right/down neighbours, so runs read as fluid strokes. */
function buildModulePath(data: boolean[][]): string {
  const size = data.length
  const isDark = (x: number, y: number) =>
    x < size && y < size && data[y][x] && !isFinder(x, y, size)

  let path = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isDark(x, y)) continue
      path += `M${x + 0.5} ${y}a.5 .5 0 0 1 0 1a.5 .5 0 0 1 0-1z`
      if (isDark(x + 1, y)) path += `M${x + 0.5} ${y}h1v1h-1z`
      if (isDark(x, y + 1)) path += `M${x} ${y + 0.5}h1v1h-1z`
    }
  }
  return path
}

/** Rounded 7×7 finder ring. It keeps the 1:1:3:1:1 ratio that scanners locate. */
const finderRingPath = (x: number, y: number) =>
  `M${x + 2} ${y}h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z` +
  `M${x + 2} ${y + 1}a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z`

interface QrCodeProps {
  value: string
  quietZone?: number
  className?: string
  /** Names the code as an image. Without it the code is decoration. */
  label?: string
}

export function QrCode({ value, quietZone = STANDARD_QUIET_ZONE, className, label }: QrCodeProps) {
  const { size, modulePath } = useMemo(() => {
    const { data, size } = encode(value, { ecc: 'M', border: 0 })
    return { size, modulePath: buildModulePath(data) }
  }, [value])

  const viewSize = size + quietZone * 2
  const finders = [
    [0, 0],
    [size - FINDER_SIZE, 0],
    [0, size - FINDER_SIZE]
  ]

  return (
    <svg
      viewBox={`${-quietZone} ${-quietZone} ${viewSize} ${viewSize}`}
      className={twMerge('block bg-[var(--qr-plate)] [forced-color-adjust:none]', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false">
      <path d={modulePath} className="fill-[var(--qr-ink)]" />
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <path d={finderRingPath(x, y)} fillRule="evenodd" className="fill-[var(--qr-ink)]" />
          <rect
            x={x + 2}
            y={y + 2}
            width={3}
            height={3}
            rx={0.9}
            className="fill-[var(--qr-eye)]"
          />
        </g>
      ))}
    </svg>
  )
}

export default QrCode
