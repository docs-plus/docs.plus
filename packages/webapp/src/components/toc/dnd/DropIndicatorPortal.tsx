import { createPortal } from 'react-dom'

interface DropIndicatorPortalProps {
  targetRect: DOMRect | null
  position: 'before' | 'after' | null
  indentLevel: number
}

/**
 * Renders a drop indicator line via portal to ensure visibility
 * above DragOverlay and other elements
 */
export function DropIndicatorPortal({ targetRect, position }: DropIndicatorPortalProps) {
  if (!targetRect || !position) return null

  // Calculate indicator Y position - align with top or bottom edge of target
  const indicatorY = position === 'before' ? targetRect.top - 1.5 : targetRect.bottom + 1.5

  return createPortal(
    <div
      className="toc-drop-indicator-portal"
      style={{
        position: 'fixed',
        top: Math.round(indicatorY),
        left: targetRect.left,
        width: targetRect.width,
        zIndex: 9000, // Behind drag overlay (10000)
        pointerEvents: 'none'
      }}>
      <div className="toc-drop-indicator-line" />
    </div>,
    document.body
  )
}
