import { useEffect, useState } from 'react'

const OWNER_BUBBLE_OPAQUE_BG =
  'color-mix(in oklch, var(--color-primary) 20%, var(--color-base-100))'

export const useMessageHighlighting = (
  isMessagePressed: boolean,
  fallbackCardElement?: HTMLElement | null
) => {
  const [highlightedMessageElement, setHighlightedMessageElement] = useState<HTMLElement | null>(
    null
  )
  const [originalMessageBounds, setOriginalMessageBounds] = useState<DOMRect | null>(null)

  const createHighlightedMessage = (event: any) => {
    const cardEl = event.target?.closest?.('.msg_card') ?? fallbackCardElement ?? null

    if (!cardEl) {
      console.warn('Could not find message card element', {
        target: event.target,
        currentTarget: event.currentTarget,
        targetType: event.target?.nodeType,
        targetName: event.target?.nodeName,
        fallbackCardElement
      })
      return null
    }

    const sourceBubble = cardEl.querySelector('.chat-bubble') as HTMLElement | null
    const rect = sourceBubble?.getBoundingClientRect()
    const clonedElement = (sourceBubble?.cloneNode(true) as HTMLElement | null) ?? null

    if (clonedElement && sourceBubble) {
      clonedElement.style.cssText = `
        margin: 0!important;
        width: 100%!important;
        min-width: 100%!important;
        transform: scale(0.98);
        transition: transform 150ms;
        transition-delay: 150ms;
      `
      // bg-primary/20 mixes with transparent; opaque mix keeps the clone readable over blur.
      if (sourceBubble.className.includes('bg-primary/20')) {
        clonedElement.style.setProperty('background-color', OWNER_BUBBLE_OPAQUE_BG, 'important')
      }
    }

    setHighlightedMessageElement(clonedElement)
    setOriginalMessageBounds(rect ?? null)

    return { rect, clonedElement, cardEl }
  }

  const clearHighlighting = () => {
    setHighlightedMessageElement(null)
    setOriginalMessageBounds(null)
  }

  useEffect(() => {
    if (!isMessagePressed && highlightedMessageElement) {
      highlightedMessageElement.style.transform = 'scale(1)'
    }
  }, [isMessagePressed, highlightedMessageElement])

  return {
    highlightedMessageElement,
    originalMessageBounds,
    createHighlightedMessage,
    clearHighlighting
  }
}
