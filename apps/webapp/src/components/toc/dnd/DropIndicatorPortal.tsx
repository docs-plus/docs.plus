import { createPortal } from 'react-dom'

interface DropIndicatorPortalProps {
  indicatorY: number
  left: number
  width: number
}

/**
 * Renders a drop indicator line via portal to ensure visibility
 * above DragOverlay and other elements
 */
export function DropIndicatorPortal({ indicatorY, left, width }: DropIndicatorPortalProps) {
  return createPortal(
    <div
      className="toc-drop-indicator-portal"
      data-y={Math.round(indicatorY)}
      style={{
        position: 'fixed',
        top: Math.round(indicatorY),
        left,
        width,
        zIndex: 50, // Behind the drag overlay (60) — floating tier, design-system.md §Elevation
        pointerEvents: 'none'
      }}>
      <div className="toc-drop-indicator-line" />
    </div>,
    document.body
  )
}
