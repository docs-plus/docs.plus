export const MEDIA_MARGIN_OPTIONS = [
  { value: '0in', label: '0"' },
  { value: '0.06in', label: '1/16"' },
  { value: '0.13in', label: '1/8"' },
  { value: '0.25in', label: '1/4"' },
  { value: '0.38in', label: '3/8"' },
  { value: '0.5in', label: '1/2"' },
  { value: '0.75in', label: '3/4"' },
  { value: '1in', label: '1"' }
] as const

export type MediaPlacementId = 'inline' | 'center' | 'right' | 'float-left' | 'float-right'

export const MEDIA_PLACEMENT_OPTIONS: ReadonlyArray<{ id: MediaPlacementId; label: string }> = [
  { id: 'inline', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
  { id: 'float-left', label: 'Wrap left' },
  { id: 'float-right', label: 'Wrap right' }
]

export function getMediaPlacementAttrs(
  id: MediaPlacementId,
  margin = '0.5in'
): Record<string, string> {
  switch (id) {
    case 'inline':
      return { display: 'block', float: 'none', clear: 'none', margin: '0' }
    case 'center':
      return { display: 'block', float: 'none', clear: 'none', margin: 'auto' }
    case 'right':
      return { display: 'block', float: 'none', clear: 'none', margin: '0 0 0 auto' }
    case 'float-left':
      return { display: 'block', float: 'left', clear: 'none', margin }
    case 'float-right':
      return { display: 'block', float: 'right', clear: 'none', margin }
  }
}

export function getCurrentMediaPlacement(attrs: Record<string, unknown>): MediaPlacementId {
  if (attrs.float === 'left') return 'float-left'
  if (attrs.float === 'right') return 'float-right'
  if (attrs.display === 'block' && attrs.margin === 'auto') return 'center'
  if (attrs.display === 'block' && attrs.margin === '0 0 0 auto') return 'right'
  return 'inline'
}

const isZeroLength = (value: string): boolean =>
  value === '0' || value === '0px' || value === '0in' || value === '0rem' || value === '0em'

/** Left+right margin expression for `calc(100% - …)` — null when there is no horizontal inset. */
export function horizontalMarginExpression(margin: string | null | undefined): string | null {
  if (margin == null) return null
  const trimmed = margin.trim()
  if (!trimmed || isZeroLength(trimmed) || /\bauto\b/i.test(trimmed)) return null

  const parts = trimmed.split(/\s+/)
  switch (parts.length) {
    case 1:
      return isZeroLength(parts[0]) ? null : `2 * ${parts[0]}`
    case 2:
    case 3:
      return isZeroLength(parts[1]) ? null : `2 * ${parts[1]}`
    case 4: {
      const right = parts[1]
      const left = parts[3]
      if (isZeroLength(left) && isZeroLength(right)) return null
      if (isZeroLength(left)) return right
      if (isZeroLength(right)) return left
      return `${left} + ${right}`
    }
    default:
      return null
  }
}

/**
 * Floated media keeps a pixel `width` while wrap margins sit outside the box —
 * `max-width: 100%` alone still overflows. Cap the border box so width + margins
 * fit the column.
 */
export function maxWidthForFloatedMedia(margin: string | null | undefined): string {
  const sum = horizontalMarginExpression(margin)
  return sum ? `calc(100% - (${sum}))` : '100%'
}

export function isFloatedMedia(float: string | null | undefined): boolean {
  return float === 'left' || float === 'right'
}
