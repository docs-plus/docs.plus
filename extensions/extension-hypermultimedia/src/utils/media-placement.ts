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

export type MediaPlacementId = 'inline' | 'center' | 'float-left' | 'float-right'

export const MEDIA_PLACEMENT_OPTIONS: ReadonlyArray<{ id: MediaPlacementId; label: string }> = [
  { id: 'inline', label: 'Left' },
  { id: 'center', label: 'Center' },
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
  return 'inline'
}
