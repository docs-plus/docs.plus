import { useState, useCallback, useLayoutEffect, useEffect, useRef } from 'react'

/**
 * Handles complex menu positioning calculations for long press menu
 */
export const useMenuPositioning = (
  isLongPressMenuVisible: boolean,
  originalMessageBounds: DOMRect | null
) => {
  const [quickReactionMenuPosition, setQuickReactionMenuPosition] = useState({ x: 0, y: 0 })
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

  const quickReactionMenuRef = useRef<HTMLDivElement>(null)
  const contextActionsMenuRef = useRef<HTMLUListElement>(null)

  // Calculate menu positions with automatic retry mechanism
  const calculateMenuPositions = useCallback(
    (retryAttempt = 0) => {
      if (
        !isLongPressMenuVisible ||
        !originalMessageBounds ||
        !quickReactionMenuRef.current ||
        !contextActionsMenuRef.current
      )
        return

      const highlightedMessageBubble = document
        .querySelector('.clone-card')
        ?.querySelector('.chat-bubble') as HTMLElement
      let currentMessageBounds = highlightedMessageBubble
        ? highlightedMessageBubble.getBoundingClientRect()
        : originalMessageBounds

      const quickReactionMenu = quickReactionMenuRef.current
      const contextActionsMenu = contextActionsMenuRef.current
      const viewportHeight = document.documentElement.clientHeight
      const viewportWidth = document.documentElement.clientWidth

      const quickReactionMenuHeight = quickReactionMenu.clientHeight
      const contextActionsMenuHeight = contextActionsMenu.clientHeight

      // Validation: Check if measurements are valid
      const areMessageBoundsValid =
        currentMessageBounds &&
        currentMessageBounds.width > 0 &&
        currentMessageBounds.height > 0 &&
        currentMessageBounds.top >= 0 &&
        currentMessageBounds.left >= 0

      const areMenuDimensionsValid = quickReactionMenuHeight > 0 && contextActionsMenuHeight > 0

      // If measurements are invalid, retry after elements render
      if (!areMessageBoundsValid || !areMenuDimensionsValid) {
        if (retryAttempt < 3) {
          setTimeout(() => calculateMenuPositions(retryAttempt + 1), 50)
          return
        }
        // Fallback: Use center of viewport if all retries failed
        console.warn('Menu positioning failed, using viewport center fallback')
        setQuickReactionMenuPosition({ x: viewportWidth / 2, y: viewportHeight / 2 - 100 })
        setContextMenuPosition({ x: viewportWidth / 2, y: viewportHeight / 2 + 50 })
        return
      }

      const menuGap = 10
      const viewportPadding = 10

      // Calculate required space for both menus
      const spaceRequiredAboveMessage = quickReactionMenuHeight + menuGap + viewportPadding
      const spaceRequiredBelowMessage = contextActionsMenuHeight + menuGap + viewportPadding
      const totalSpaceRequired =
        spaceRequiredAboveMessage + currentMessageBounds.height + spaceRequiredBelowMessage

      // Check if we need to reposition the message card
      const availableSpaceAboveMessage = currentMessageBounds.top
      const availableSpaceBelowMessage = viewportHeight - currentMessageBounds.bottom

      if (
        availableSpaceAboveMessage < spaceRequiredAboveMessage ||
        availableSpaceBelowMessage < spaceRequiredBelowMessage
      ) {
        // Reposition message card to center in viewport with adequate space
        const idealMessageTop =
          (viewportHeight - totalSpaceRequired) / 2 + spaceRequiredAboveMessage
        const messageRepositionOffset = idealMessageTop - currentMessageBounds.top

        // Actually move the highlighted message card
        if (highlightedMessageBubble) {
          const highlightedMessageCard = highlightedMessageBubble.closest(
            '.clone-card'
          ) as HTMLElement
          if (highlightedMessageCard) {
            highlightedMessageCard.style.transform = `translateY(${messageRepositionOffset}px)`

            // Update bounds calculations for the repositioned message
            currentMessageBounds = {
              ...currentMessageBounds,
              top: idealMessageTop,
              bottom: idealMessageTop + currentMessageBounds.height
            }

            // Set initial menu positions at repositioned message location before animation
            const repositionedMessageCenterX =
              currentMessageBounds.left + currentMessageBounds.width / 2
            const initialQuickReactionY = currentMessageBounds.top
            const initialContextActionsY = currentMessageBounds.bottom

            // Immediately position menus at message edges before final animation
            // Quick reaction menu centered horizontally, context menu aligned with message
            setQuickReactionMenuPosition({
              x: viewportWidth / 2,
              y: initialQuickReactionY
            })
            setContextMenuPosition({ x: repositionedMessageCenterX, y: initialContextActionsY })

            // Ensure DOM update before calculating final positions
            requestAnimationFrame(() => {
              // Continue with normal positioning calculation below
            })
          }
        }
      }

      // Position quick reaction menu above the message
      const quickReactionMenuY = currentMessageBounds.top - menuGap - quickReactionMenuHeight

      // Always center the quick reaction menu horizontally on screen
      const quickReactionMenuX = viewportWidth / 2

      // Position context actions menu below the message - keep it aligned with message
      const contextActionsMenuY = currentMessageBounds.bottom + menuGap
      const messageCenterX = currentMessageBounds.left + currentMessageBounds.width / 2
      let contextActionsMenuX = messageCenterX

      // Constrain context actions menu horizontally to stay in viewport
      const approximateMenuWidth = 200
      const halfMenuWidth = approximateMenuWidth / 2

      if (contextActionsMenuX - halfMenuWidth < viewportPadding) {
        contextActionsMenuX = viewportPadding + halfMenuWidth
      } else if (contextActionsMenuX + halfMenuWidth > viewportWidth - viewportPadding) {
        contextActionsMenuX = viewportWidth - viewportPadding - halfMenuWidth
      }

      setQuickReactionMenuPosition({ x: quickReactionMenuX, y: quickReactionMenuY })
      setContextMenuPosition({ x: contextActionsMenuX, y: contextActionsMenuY })
    },
    [isLongPressMenuVisible, originalMessageBounds]
  )

  const setInitialPositions = useCallback((rect: DOMRect | undefined) => {
    if (!rect) return

    const viewportWidth = document.documentElement.clientWidth
    const messageCenterX = rect.left + rect.width / 2

    // Quick reaction menu always centered horizontally
    setQuickReactionMenuPosition({ x: viewportWidth / 2, y: rect.top - 10 })
    // Context menu aligned with message
    setContextMenuPosition({ x: messageCenterX, y: rect.bottom + 10 })
  }, [])

  const setFallbackPositions = useCallback((targetRect: DOMRect) => {
    const viewportWidth = document.documentElement.clientWidth
    const targetCenterX = targetRect.left + targetRect.width / 2

    // Quick reaction menu always centered horizontally
    setQuickReactionMenuPosition({ x: viewportWidth / 2, y: targetRect.top - 10 })
    // Context menu aligned with target
    setContextMenuPosition({ x: targetCenterX, y: targetRect.bottom + 10 })
  }, [])

  // Initial positioning after menu becomes visible
  useLayoutEffect(() => {
    if (!isLongPressMenuVisible) return

    // Delay to ensure DOM elements are rendered
    const positioningTimer = setTimeout(calculateMenuPositions, 0)
    return () => clearTimeout(positioningTimer)
  }, [isLongPressMenuVisible, calculateMenuPositions])

  // Track menu size changes and recalculate positions
  useEffect(() => {
    if (!isLongPressMenuVisible || !quickReactionMenuRef.current || !contextActionsMenuRef.current)
      return

    const resizeObserver = new ResizeObserver(() => {
      calculateMenuPositions(0)
    })

    resizeObserver.observe(quickReactionMenuRef.current)
    resizeObserver.observe(contextActionsMenuRef.current)

    return () => resizeObserver.disconnect()
  }, [isLongPressMenuVisible, calculateMenuPositions])

  return {
    quickReactionMenuPosition,
    contextMenuPosition,
    quickReactionMenuRef,
    contextActionsMenuRef,
    setInitialPositions,
    setFallbackPositions
  }
}
