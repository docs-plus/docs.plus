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
  const [adjustedMessageBounds, setAdjustedMessageBounds] = useState<DOMRect | null>(null)

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

      const quickReactionMenu = quickReactionMenuRef.current
      const contextActionsMenu = contextActionsMenuRef.current
      const viewportHeight = document.documentElement.clientHeight
      const viewportWidth = document.documentElement.clientWidth

      const quickReactionMenuHeight = quickReactionMenu.clientHeight
      const contextActionsMenuHeight = contextActionsMenu.clientHeight

      // Validation: Check if measurements are valid
      const leftValue = originalMessageBounds.left ?? originalMessageBounds.x ?? 0
      const topValue = originalMessageBounds.top ?? originalMessageBounds.y ?? 0

      const areMessageBoundsValid =
        originalMessageBounds &&
        originalMessageBounds.width > 0 &&
        originalMessageBounds.height > 0 &&
        !Number.isNaN(topValue) &&
        !Number.isNaN(leftValue) &&
        topValue >= 0 &&
        leftValue >= 0

      const areMenuDimensionsValid = quickReactionMenuHeight > 0 && contextActionsMenuHeight > 0

      // If measurements are invalid, retry after elements render
      if (!areMessageBoundsValid || !areMenuDimensionsValid) {
        if (retryAttempt < 3) {
          setTimeout(() => calculateMenuPositions(retryAttempt + 1), 50)
          return
        }
        // Fallback: Use center of viewport if all retries failed
        console.warn('Menu positioning failed, using viewport center fallback')
        const fallbackX = Math.floor(viewportWidth / 2)
        const fallbackQuickY = Math.floor(viewportHeight / 2 - 100)
        const fallbackContextY = Math.floor(viewportHeight / 2 + 50)

        setQuickReactionMenuPosition({ x: fallbackX, y: fallbackQuickY })
        setContextMenuPosition({ x: fallbackX, y: fallbackContextY })
        return
      }

      const menuGap = 12
      const viewportPadding = 20

      // Calculate required space for both menus
      const spaceRequiredAbove = quickReactionMenuHeight + menuGap
      const spaceRequiredBelow = contextActionsMenuHeight + menuGap
      const totalSpaceRequired =
        spaceRequiredAbove + originalMessageBounds.height + spaceRequiredBelow

      // Check if we have enough space at the current message position
      const currentTop = originalMessageBounds.top ?? originalMessageBounds.y ?? 0
      const currentBottom =
        originalMessageBounds.bottom ?? currentTop + originalMessageBounds.height
      const currentLeft = originalMessageBounds.left ?? originalMessageBounds.x ?? 0
      const currentRight = originalMessageBounds.right ?? currentLeft + originalMessageBounds.width

      const spaceAbove = currentTop
      const spaceBelow = viewportHeight - currentBottom

      let messageBounds = originalMessageBounds
      let messageRepositioned = false

      // If insufficient space, reposition the message to center in viewport
      if (spaceAbove < spaceRequiredAbove || spaceBelow < spaceRequiredBelow) {
        if (totalSpaceRequired <= viewportHeight - 2 * viewportPadding) {
          // Calculate ideal position to center everything
          const idealMessageTop = Math.floor(
            (viewportHeight - totalSpaceRequired) / 2 + spaceRequiredAbove
          )

          // Create adjusted bounds for repositioned message - ensure all properties are set
          messageBounds = {
            ...originalMessageBounds,
            top: idealMessageTop,
            bottom: idealMessageTop + originalMessageBounds.height,
            left: currentLeft,
            right: currentRight,
            x: currentLeft,
            y: idealMessageTop,
            width: originalMessageBounds.width,
            height: originalMessageBounds.height
          } as DOMRect

          setAdjustedMessageBounds(messageBounds)
          messageRepositioned = true
        }
      } else {
        setAdjustedMessageBounds(null)
      }

      const messageCenterX = Math.floor(
        (messageBounds.left ?? messageBounds.x ?? 0) + messageBounds.width / 2
      )

      // Position quick reaction menu above the message (centered horizontally)
      const messageTop = messageBounds.top ?? messageBounds.y ?? 0
      const messageBottom = messageBounds.bottom ?? messageTop + messageBounds.height

      let quickReactionMenuY = messageTop - menuGap - quickReactionMenuHeight
      const quickReactionMenuX = Math.floor(viewportWidth / 2)

      // Ensure it stays within viewport
      quickReactionMenuY = Math.max(viewportPadding, quickReactionMenuY)

      // Position context actions menu below the message
      let contextActionsMenuY = messageBottom + menuGap
      let contextActionsMenuX = messageCenterX

      // Ensure it stays within viewport
      contextActionsMenuY = Math.min(
        viewportHeight - viewportPadding - contextActionsMenuHeight,
        contextActionsMenuY
      )

      // Constrain context actions menu horizontally to stay in viewport
      const approximateMenuWidth = 200
      const halfMenuWidth = approximateMenuWidth / 2

      if (contextActionsMenuX - halfMenuWidth < viewportPadding) {
        contextActionsMenuX = viewportPadding + halfMenuWidth
      } else if (contextActionsMenuX + halfMenuWidth > viewportWidth - viewportPadding) {
        contextActionsMenuX = viewportWidth - viewportPadding - halfMenuWidth
      }

      // Validate final positions before setting
      const finalQuickX = Number.isFinite(quickReactionMenuX)
        ? quickReactionMenuX
        : Math.floor(viewportWidth / 2)
      const finalQuickY = Number.isFinite(quickReactionMenuY) ? quickReactionMenuY : viewportPadding
      const finalContextX = Number.isFinite(contextActionsMenuX)
        ? Math.floor(contextActionsMenuX)
        : Math.floor(viewportWidth / 2)
      const finalContextY = Number.isFinite(contextActionsMenuY)
        ? Math.floor(contextActionsMenuY)
        : viewportHeight - contextActionsMenuHeight - viewportPadding

      setQuickReactionMenuPosition({ x: finalQuickX, y: finalQuickY })
      setContextMenuPosition({ x: finalContextX, y: finalContextY })
    },
    [isLongPressMenuVisible, originalMessageBounds]
  )

  const setInitialPositions = useCallback((rect: DOMRect | undefined) => {
    if (!rect) return

    const viewportWidth = document.documentElement.clientWidth
    const messageCenterX = Math.floor(rect.left + rect.width / 2)

    // Quick reaction menu always centered horizontally
    setQuickReactionMenuPosition({ x: Math.floor(viewportWidth / 2), y: rect.top - 10 })
    // Context menu aligned with message
    setContextMenuPosition({ x: Math.floor(messageCenterX), y: Math.floor(rect.bottom + 10) })
  }, [])

  const setFallbackPositions = useCallback((targetRect: DOMRect) => {
    const viewportWidth = document.documentElement.clientWidth
    const targetCenterX = Math.floor(targetRect.left + targetRect.width / 2)

    // Quick reaction menu always centered horizontally
    setQuickReactionMenuPosition({ x: Math.floor(viewportWidth / 2), y: targetRect.top - 10 })
    // Context menu aligned with target
    setContextMenuPosition({ x: Math.floor(targetCenterX), y: Math.floor(targetRect.bottom + 10) })
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
    setFallbackPositions,
    adjustedMessageBounds
  }
}
