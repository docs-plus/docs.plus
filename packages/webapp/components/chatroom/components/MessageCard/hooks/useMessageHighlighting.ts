import { useState, useEffect } from 'react'

/**
 * Handles message cloning and highlighting for long press menu
 */
export const useMessageHighlighting = (
  isMessagePressed: boolean,
  fallbackCardElement?: HTMLElement | null
) => {
  const [highlightedMessageElement, setHighlightedMessageElement] = useState<HTMLElement | null>(
    null
  )
  const [originalMessageBounds, setOriginalMessageBounds] = useState<DOMRect | null>(null)

  const createHighlightedMessage = (event: any) => {
    // Try multiple fallback strategies to find the message card
    let cardEl = null

    // Strategy 1: Use closest on event.target
    if (event.target?.closest) {
      cardEl = event.target.closest('.msg_card')
    }

    // Strategy 2: Use fallback card element from long press interaction
    if (!cardEl && fallbackCardElement) {
      cardEl = fallbackCardElement
      console.info('Using fallback card element from long press interaction')
    }

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

    const rect = cardEl.querySelector('.chat-bubble')?.getBoundingClientRect()
    const clonedElement = cardEl.querySelector('.chat-bubble')?.cloneNode(true) as HTMLElement

    // Add custom styles to the cloned element
    if (clonedElement) {
      clonedElement.style.cssText = `
        margin: 0!important;
        width: 100%!important;
        min-width: 100%!important;
        transform: scale(0.98);
        transition: transform 150ms;
        transition-delay: 150ms;
      `
    }

    setHighlightedMessageElement(clonedElement)
    setOriginalMessageBounds(rect || null)

    return { rect, clonedElement, cardEl }
  }

  const clearHighlighting = () => {
    setHighlightedMessageElement(null)
    setOriginalMessageBounds(null)
  }

  // Handle highlighting scale effect
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
