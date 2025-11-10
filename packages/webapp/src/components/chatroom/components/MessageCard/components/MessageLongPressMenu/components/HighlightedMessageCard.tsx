import { forwardRef } from 'react'

interface HighlightedMessageCardProps {
  messageElement: HTMLElement | null
  messageBounds: DOMRect | null
  isVisible: boolean
  className?: string
}

export const HighlightedMessageCard = forwardRef<HTMLDivElement, HighlightedMessageCardProps>(
  ({ messageElement, messageBounds, isVisible, className }, ref) => {
    // Don't render if we don't have both the element and bounds

    if (!messageElement || !messageBounds) {
      return null
    }

    // Handle both DOMRect (left/top) and custom bounds (x/y) formats
    const leftPosition =
      'left' in messageBounds ? messageBounds.left : (messageBounds as any).x || 0
    const topPosition = 'top' in messageBounds ? messageBounds.top : (messageBounds as any).y || 0
    const boundsHeight = messageBounds.height || 0

    return (
      <div
        ref={ref}
        className={`clone-card pointer-events-auto transition-all duration-200 ease-out select-none ${className || ''}`}
        style={{
          position: 'fixed',
          left: leftPosition,
          top: topPosition,
          width: 'auto',
          height: boundsHeight,
          zIndex: 60,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)'
        }}
        onClick={(e) => e.stopPropagation()}
        dangerouslySetInnerHTML={{ __html: messageElement.outerHTML }}
      />
    )
  }
)

HighlightedMessageCard.displayName = 'HighlightedMessageCard'
