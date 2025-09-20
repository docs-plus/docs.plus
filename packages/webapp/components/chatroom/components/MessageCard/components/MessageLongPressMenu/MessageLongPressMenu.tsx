import { useCallback, createContext, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { QuickReactionMenu } from '@components/chatroom/components/MessageCard/components/MessageLongPressMenu/components/QuickReactionMenu'
import { ContextActionsMenu } from './components/ContextActionsMenu'
import { HighlightedMessageCard } from './components/HighlightedMessageCard'
import {
  useMenuVisibility,
  useMessageHighlighting,
  useMenuPositioning,
  useLongPressInteraction
} from '../../hooks'
import { emojiReaction } from '@api'
import { TMsgRow } from '@types'

// Context for passing hideMenu to child components
const MessageLongPressMenuContext = createContext<{ hideMenu: () => void } | null>(null)

export const useMessageLongPressMenu = () => {
  const context = useContext(MessageLongPressMenuContext)
  if (!context) {
    throw new Error('useMessageLongPressMenu must be used within MessageLongPressMenuProvider')
  }
  return context
}

type Props = {
  children: React.ReactNode
  message: TMsgRow
}

export const MessageLongPressMenu = ({ children, message }: Props) => {
  // Initialize hooks in correct order
  const { isLongPressMenuVisible, isMenuEnterAnimationActive, showMenu, hideMenu } =
    useMenuVisibility()

  const {
    isMessagePressed,
    isLongPressCompleted,
    longPressBindings,
    setOnActivation,
    setLongPressCompleted,
    messageCardElement
  } = useLongPressInteraction()

  const {
    highlightedMessageElement,
    originalMessageBounds,
    createHighlightedMessage,
    clearHighlighting
  } = useMessageHighlighting(isMessagePressed, messageCardElement)

  const {
    quickReactionMenuPosition,
    contextMenuPosition,
    quickReactionMenuRef,
    contextActionsMenuRef,
    setInitialPositions,
    setFallbackPositions,
    adjustedMessageBounds
  } = useMenuPositioning(isLongPressMenuVisible, originalMessageBounds)

  const handleLongPressActivation = useCallback(
    (event: any) => {
      const result = createHighlightedMessage(event)

      if (result) {
        const { rect, cardEl } = result
        setInitialPositions(rect)

        // Reset the transform scale
        const chatBubble = cardEl?.querySelector('.chat-bubble') as HTMLElement
        if (cardEl && chatBubble) {
          chatBubble.style.transform = 'scale(1)'
        }
      } else {
        clearHighlighting()
        const targetRect = event.target.getBoundingClientRect()
        setFallbackPositions(targetRect)
      }

      showMenu()
    },
    [
      createHighlightedMessage,
      setInitialPositions,
      clearHighlighting,
      setFallbackPositions,
      showMenu
    ]
  )

  // Set the activation callback
  setOnActivation(handleLongPressActivation)

  const closeLongPressMenu = useCallback(() => {
    hideMenu()
    clearHighlighting()
    setLongPressCompleted(false) // Reset completion state when menu closes
  }, [hideMenu, clearHighlighting, setLongPressCompleted])

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const element = document.createElement('div')
    element.setAttribute('data-message-long-press-menu-portal', '')
    document.body.appendChild(element)
    setPortalContainer(element)

    return () => {
      document.body.removeChild(element)
    }
  }, [])

  // Trigger completion when menu animation becomes active
  useEffect(() => {
    if (isMenuEnterAnimationActive) setLongPressCompleted(true)
  }, [isMenuEnterAnimationActive])

  const handleEmojiReaction = (nativeEmoji: string) => {
    console.log(`Reacted with ${nativeEmoji}`)
    // TODO: Add actual reaction logic here
    emojiReaction(message, nativeEmoji)
  }

  return (
    <MessageLongPressMenuContext.Provider value={{ hideMenu: closeLongPressMenu }}>
      <>
        <div
          {...longPressBindings()}
          className="pointer-events-auto select-none"
          style={{
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            touchAction: 'manipulation'
          }}>
          {children}
        </div>

        {portalContainer &&
          isLongPressMenuVisible &&
          createPortal(
            <div
              className="fixed inset-0 z-50 overflow-auto transition-all duration-200 ease-out"
              style={{
                backdropFilter: 'blur(6px)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                opacity: isMenuEnterAnimationActive ? 1 : 0
              }}
              onClick={closeLongPressMenu}>
              {/* Highlighted Message Card - Fixed at original or adjusted position */}
              <HighlightedMessageCard
                messageElement={highlightedMessageElement}
                messageBounds={adjustedMessageBounds || originalMessageBounds}
                isVisible={isMenuEnterAnimationActive}
              />
              {/* Quick Reaction Menu - Above message */}
              <QuickReactionMenu
                ref={quickReactionMenuRef}
                position={quickReactionMenuPosition}
                isVisible={isMenuEnterAnimationActive}
                isInteractive={isLongPressCompleted}
                onReactionSelect={handleEmojiReaction}
                message={message}
              />
              {/* Context Actions Menu - Below message */}
              <ContextActionsMenu
                ref={contextActionsMenuRef}
                position={contextMenuPosition}
                isVisible={isMenuEnterAnimationActive}
                isInteractive={isLongPressCompleted}
                message={message}
              />
            </div>,
            portalContainer
          )}
      </>
    </MessageLongPressMenuContext.Provider>
  )
}
