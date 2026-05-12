import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { useUnreadCount } from '@components/toc/hooks'
import Button from '@components/ui/Button'
import UnreadBadge from '@components/ui/UnreadBadge'
import { Icons } from '@icons'
import { type IChatStore, useChatStore } from '@stores'
import React, { useCallback, useEffect, useState } from 'react'

import { useMessageFeedContext } from '../MessageFeedContext'

const BOTTOM_THRESHOLD_PX = 64

export const ScrollToBottom = () => {
  const [isVisible, setIsVisible] = useState(false)
  const { channelId } = useChatroomContext()
  const { messageContainerRef, virtualizerRef } = useMessageFeedContext()
  const unreadCount = useUnreadCount(channelId)
  const isInitialScrollSettled = useChatStore((state) => state.chatRoom.isInitialScrollSettled)
  const selectMessageCount = useCallback(
    (state: IChatStore) => state.messagesByChannel.get(channelId)?.size ?? 0,
    [channelId]
  )
  const messageCount = useChatStore(selectMessageCount)

  const updateVisibility = useCallback(() => {
    const container = messageContainerRef.current
    const virtualizer = virtualizerRef.current

    if (!container || !virtualizer || !isInitialScrollSettled || messageCount === 0) {
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
  }, [messageContainerRef, virtualizerRef, isInitialScrollSettled, messageCount])

  useEffect(() => {
    updateVisibility()
  }, [updateVisibility])

  useEffect(() => {
    const container = messageContainerRef.current
    if (!container || !isInitialScrollSettled) return

    const handleScroll = () => updateVisibility()
    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [messageContainerRef, updateVisibility, isInitialScrollSettled])

  const scrollToBottomHandler = useCallback(() => {
    const virtualizer = virtualizerRef.current
    if (!virtualizer || messageCount === 0) return

    const totalCount = virtualizer.options.count ?? 0
    if (totalCount === 0) return

    virtualizer.scrollToIndex(totalCount - 1, { align: 'end', behavior: 'smooth' })
    setIsVisible(false)
  }, [virtualizerRef, messageCount])

  return (
    <Button
      onClick={scrollToBottomHandler}
      onPointerDown={(e) => e.preventDefault()}
      variant="primary"
      shape="circle"
      className={`absolute right-2 z-20 transition-all duration-300 ${
        isVisible
          ? 'bottom-3 opacity-100 delay-200'
          : 'pointer-events-none bottom-[-60px] opacity-0'
      }`}
      startIcon={<Icons.chevronDown size={20} className="text-primary-content" />}>
      <UnreadBadge
        count={unreadCount}
        size="sm"
        variant="error"
        className="absolute -top-1 -right-1"
      />
    </Button>
  )
}
