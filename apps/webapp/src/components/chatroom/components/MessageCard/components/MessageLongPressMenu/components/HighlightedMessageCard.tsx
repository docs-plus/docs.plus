import { twMerge } from '@utils/twMerge'
import DOMPurify from 'dompurify'
import { forwardRef, useMemo } from 'react'

import { longPressMotionClass } from './longPressMotion'

interface HighlightedMessageCardProps {
  messageElement: HTMLElement | null
  messageBounds: DOMRect | null
  isVisible: boolean
  className?: string
}

export const HighlightedMessageCard = forwardRef<HTMLDivElement, HighlightedMessageCardProps>(
  ({ messageElement, messageBounds, isVisible, className }, ref) => {
    // Defense-in-depth: the source DOM came from DOMPurify-gated render
    // paths, but a future regression upstream would silently turn this
    // clone-card into a parallel XSS sink. Re-sanitise on the way back in.
    const sanitizedHtml = useMemo(
      () => (messageElement ? DOMPurify.sanitize(messageElement.outerHTML) : ''),
      [messageElement]
    )

    if (!messageElement || !messageBounds) {
      return null
    }

    return (
      <div
        ref={ref}
        className={twMerge(
          'clone-card pointer-events-auto z-[60] select-none',
          longPressMotionClass(isVisible),
          className
        )}
        style={{
          position: 'fixed',
          left: messageBounds.left,
          top: messageBounds.top,
          width: 'auto',
          height: messageBounds.height,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)'
        }}
        onClick={(e) => e.stopPropagation()}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    )
  }
)

HighlightedMessageCard.displayName = 'HighlightedMessageCard'
