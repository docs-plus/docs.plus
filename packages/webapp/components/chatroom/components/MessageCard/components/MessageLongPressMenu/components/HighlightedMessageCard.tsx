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

    return (
      <div
        ref={ref}
        className={`clone-card pointer-events-auto transition-all duration-200 ease-out select-none ${className || ''}`}
        style={{
          position: 'fixed',
          left: messageBounds.left,
          top: messageBounds.top,
          width: messageBounds.width,
          height: messageBounds.height,
          zIndex: 60,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'scale(1)' : 'scale(0.9)'
        }}
        onClick={(e) => e.stopPropagation()}
        dangerouslySetInnerHTML={{ __html: messageElement.outerHTML }}
      />
    )
  }
)

HighlightedMessageCard.displayName = 'HighlightedMessageCard'
