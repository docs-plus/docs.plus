/** Pure lightbox zoom math — DOM adapters live in `useGalleryZoomPan`. */

export const MIN_SCALE = 1
export const MAX_SCALE = 5
export const ZOOM_STEP = 0.15
export const CLICK_ZOOM = 2.5
export const FIT_SNAP_EPSILON = 0.04
export const DOUBLE_TAP_MS = 300
export const TAP_SLOP_PX = 30

export type ZoomPoint = { x: number; y: number }

export type ZoomState = {
  scale: number
  offset: ZoomPoint
}

export const FIT_ZOOM_STATE: ZoomState = {
  scale: MIN_SCALE,
  offset: { x: 0, y: 0 }
}

export const snapScale = (value: number): number => {
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
  return clamped <= MIN_SCALE + FIT_SNAP_EPSILON ? MIN_SCALE : clamped
}

export const isFitScale = (value: number): boolean => value <= MIN_SCALE + FIT_SNAP_EPSILON

/**
 * Zoom toward a point measured from the host layout center (not the transformed child).
 * Returns fit state when the snapped scale collapses to 1×.
 */
export function zoomStateAtPoint(
  current: ZoomState,
  pointFromCenter: ZoomPoint,
  nextScale: number
): ZoomState {
  const clamped = snapScale(nextScale)
  if (isFitScale(clamped)) return FIT_ZOOM_STATE

  if (isFitScale(current.scale)) {
    return {
      scale: clamped,
      offset: {
        x: -pointFromCenter.x * (clamped - 1),
        y: -pointFromCenter.y * (clamped - 1)
      }
    }
  }

  const ratio = clamped / current.scale
  return {
    scale: clamped,
    offset: {
      x: current.offset.x * ratio - pointFromCenter.x * (ratio - 1),
      y: current.offset.y * ratio - pointFromCenter.y * (ratio - 1)
    }
  }
}
