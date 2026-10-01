import { createPortal } from 'react-dom'

interface DropIndicatorPortalProps {
  indicatorY: number
  left: number
  width: number
}

export function DropIndicatorPortal({ indicatorY, left, width }: DropIndicatorPortalProps) {
  return createPortal(
    <div
      className="toc-drop-indicator-portal z-50"
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
