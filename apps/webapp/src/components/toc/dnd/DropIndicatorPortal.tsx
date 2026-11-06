import { createPortal } from 'react-dom'

interface DropIndicatorPortalProps {
  indicatorY: number
  left: number
  width: number
}

// Same tier as the drag card, which sits under the pointer where the line is drawn. This
// portal mounts after the card's, so at an equal z-index the line paints on top.
export function DropIndicatorPortal({ indicatorY, left, width }: DropIndicatorPortalProps) {
  return createPortal(
    <div
      className="toc-drop-indicator-portal z-[60]"
      data-y={Math.round(indicatorY)}
      style={{
        position: 'fixed',
        top: Math.round(indicatorY),
        left,
        width,
        pointerEvents: 'none'
      }}>
      <div className="toc-drop-indicator-line" />
    </div>,
    document.body
  )
}
