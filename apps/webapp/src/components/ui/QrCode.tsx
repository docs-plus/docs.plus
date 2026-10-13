import { buildModulePath, encodeQr, finderOrigins, finderRingPath } from '@utils/qrCodePaths'
import { twMerge } from '@utils/twMerge'
import { useMemo } from 'react'

// ISO/IEC 18004 asks for a 4-module light margin; a smaller one must sit on a light surface.
const STANDARD_QUIET_ZONE = 4

interface QrCodeProps {
  value: string
  quietZone?: number
  className?: string
  /** Names the code as an image. Without it the code is decoration. */
  label?: string
}

export function QrCode({ value, quietZone = STANDARD_QUIET_ZONE, className, label }: QrCodeProps) {
  const { size, modulePath } = useMemo(() => {
    const { data, size } = encodeQr(value)
    return { size, modulePath: buildModulePath(data) }
  }, [value])

  const viewSize = size + quietZone * 2

  return (
    <svg
      viewBox={`${-quietZone} ${-quietZone} ${viewSize} ${viewSize}`}
      className={twMerge('block bg-[var(--qr-plate)] [forced-color-adjust:none]', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false">
      <path d={modulePath} className="fill-[var(--qr-ink)]" />
      {finderOrigins(size).map(([x, y]) => (
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
