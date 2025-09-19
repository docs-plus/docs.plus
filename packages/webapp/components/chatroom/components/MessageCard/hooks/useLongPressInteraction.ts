import { useChatStore } from '@stores'
import { useState, useCallback, useRef } from 'react'
import { LongPressEventType, useLongPress } from 'use-long-press'

/**
 * Handles long press interaction events and visual feedback
 */
export const useLongPressInteraction = () => {
  const [isMessagePressed, setIsMessagePressed] = useState(false)
  const [isLongPressCompleted, setIsLongPressCompleted] = useState(false)
  const onActivationRef = useRef<((event: any) => void) | null>(null)
  const messageCardElementRef = useRef<HTMLElement | null>(null)
  const updateChatRoom = useChatStore((state) => state.updateChatRoom)

  const handleLongPressStart = useCallback((event: any) => {
    setIsMessagePressed(true)
    setIsLongPressCompleted(false) // Reset completion state
    const messageCardElement = event.target.closest('.msg_card') as HTMLElement
    messageCardElementRef.current = messageCardElement // Store reference

    if (messageCardElement) {
      const messageBubble = messageCardElement.querySelector('.chat-bubble') as HTMLElement
      if (messageBubble) {
        messageBubble.style.transition = 'transform 150ms'
        messageBubble.style.transform = 'scale(0.98)'
      }
    }
  }, [])

  const handleLongPressFinish = useCallback((event: any) => {
    setIsMessagePressed(false)
    setIsLongPressCompleted(true) // Mark as completed - buttons become active
    updateChatRoom('disableScroll', true)
  }, [])

  const handleLongPressCancel = useCallback((event: any) => {
    setIsMessagePressed(false)
    setIsLongPressCompleted(false) // Reset on cancel
    console.info('Long press cancelled')

    // Use stored reference first, fallback to closest
    const messageCardElement =
      messageCardElementRef.current || (event.target.closest('.msg_card') as HTMLElement)
    if (messageCardElement) {
      const messageBubble = messageCardElement.querySelector('.chat-bubble') as HTMLElement
      if (messageBubble) {
        messageBubble.style.transform = 'scale(1)'
      }
    }

    updateChatRoom('disableScroll', false)
    messageCardElementRef.current = null // Clear reference
  }, [])

  const handleActivation = useCallback((event: any) => {
    onActivationRef.current?.(event)
  }, [])

  const longPressBindings = useLongPress(handleActivation, {
    onStart: handleLongPressStart,
    onFinish: handleLongPressFinish,
    onCancel: handleLongPressCancel,
    threshold: 500,
    captureEvent: true,
    cancelOnMovement: 5,
    cancelOutsideElement: true,
    detect: LongPressEventType.Touch
  })

  const setOnActivation = useCallback((callback: (event: any) => void) => {
    onActivationRef.current = callback
  }, [])

  const setLongPressCompleted = useCallback((completed: boolean) => {
    setIsLongPressCompleted(completed)
    updateChatRoom('disableScroll', false)
  }, [])

  return {
    isMessagePressed,
    isLongPressCompleted,
    longPressBindings,
    setOnActivation,
    setLongPressCompleted,
    messageCardElement: messageCardElementRef.current
  }
}
