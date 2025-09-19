import React, { useState, useEffect, useCallback } from 'react'
import { FaChevronDown } from 'react-icons/fa6'
import { useMessageFeedContext } from '../MessageFeedContext'
import { useChatStore } from '@stores'
import { useChatroomContext } from '@components/chatroom/ChatroomContext'

const BOTTOM_THRESHOLD_PX = 64

export const ScrollToBottom = () => {
  const [isVisible, setIsVisible] = useState(false)
  const { channelId } = useChatroomContext()
  const { messageContainerRef, virtualizerRef } = useMessageFeedContext()
  const isReadyToDisplayMessages = useChatStore((state) => state.chatRoom.isReadyToDisplayMessages)
  const selectMessageCount = useCallback(
    (state: any) => state.messagesByChannel.get(channelId)?.size ?? 0,
    [channelId]
  )
  const messageCount = useChatStore(selectMessageCount)

  const updateVisibility = useCallback(() => {
    const container = messageContainerRef.current
    const virtualizer = virtualizerRef.current

    if (!container || !virtualizer || !isReadyToDisplayMessages || messageCount === 0) {
      setIsVisible(false)
      return
    }

    const virtualItems = virtualizer.getVirtualItems()
    if (virtualItems.length === 0) {
      setIsVisible(false)
      return
    }

    const lastItem = virtualItems[virtualItems.length - 1]
    const totalCount = virtualizer.options.count ?? 0

    const scrollOffset = virtualizer.scrollOffset ?? container.scrollTop ?? 0
    const viewportBottom = scrollOffset + container.clientHeight
    const shouldHideButton =
      lastItem.index >= totalCount - 1 && lastItem.end <= viewportBottom + BOTTOM_THRESHOLD_PX

    setIsVisible((prev) => {
      const next = !shouldHideButton
      return prev === next ? prev : next
    })
  }, [messageContainerRef, virtualizerRef, isReadyToDisplayMessages, messageCount])

  useEffect(() => {
    updateVisibility()
  }, [updateVisibility])

  useEffect(() => {
    const container = messageContainerRef.current
    if (!container || !isReadyToDisplayMessages) return

    const handleScroll = () => updateVisibility()
    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [messageContainerRef, updateVisibility, isReadyToDisplayMessages])

  const scrollToBottomHandler = useCallback(() => {
    const virtualizer = virtualizerRef.current
    if (!virtualizer || messageCount === 0) return

    const totalCount = virtualizer.options.count ?? 0
    if (totalCount === 0) return

    virtualizer.scrollToIndex(totalCount - 1, { align: 'end', behavior: 'smooth' })
    setIsVisible(false)
  }, [virtualizerRef, messageCount])

  return (
    <button
      onClick={scrollToBottomHandler}
      className={`btn btn-circle btn-primary absolute right-2 z-20 transition-all duration-300 ${
        isVisible
          ? 'bottom-3 opacity-100 delay-200'
          : 'pointer-events-none bottom-[-60px] opacity-0'
      }`}>
      <FaChevronDown size={23} color="#fff" />
    </button>
  )
}
