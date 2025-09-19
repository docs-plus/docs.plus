import React, { useCallback, useEffect } from 'react'
import { isSameDay, parseISO } from 'date-fns'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useChatStore } from '@stores'
import { useMessageListContext } from '../MessageListContext'
import { SystemNotifyChip } from './SystemNotifyChip'
import { DateChip } from './DateChip'
import { UnreadIndicatorLine } from './UnreadIndicatorLine'

interface Props {
  children?: (message: any, index: number, messages: any[]) => React.ReactNode
  displaySystemNotifyChip?: boolean
}

const isNewDay = (currentMessageDate: string, previousMessageDate: string) => {
  return !isSameDay(parseISO(currentMessageDate), parseISO(previousMessageDate))
}

export const MessageLoop = ({ children, displaySystemNotifyChip = true }: Props) => {
  const { messagesArray, channelId, isScrollingUp, messageContainerRef, registerVirtualizer } =
    useMessageListContext()

  // Get channel settings for unread indicator
  const channelSettings = useChatStore((state: any) =>
    state.workspaceSettings.channels.get(channelId)
  )
  const { lastReadMessageId, totalMsgSincLastRead } = channelSettings || {
    lastReadMessageId: '',
    totalMsgSincLastRead: 0
  }

  const getItemKey = useCallback(
    (index: number) => messagesArray[index]?.id ?? index,
    [messagesArray]
  )

  const estimateSize = useCallback(
    (index: number) => {
      const message = messagesArray[index]
      if (!message) return 80
      if (message.type === 'notification') return 56
      return message.isGroupStart ? 128 : 96
    },
    [messagesArray]
  )

  const virtualizer = useVirtualizer({
    count: messagesArray.length,
    getScrollElement: () => messageContainerRef.current,
    estimateSize,
    getItemKey,
    overscan: 10
  })

  const virtualItems = virtualizer.getVirtualItems()

  useEffect(() => {
    // @ts-ignore
    registerVirtualizer(virtualizer)
    return () => registerVirtualizer(null)
  }, [virtualizer, registerVirtualizer])

  return (
    <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
      {virtualItems.map((virtualRow) => {
        const message = messagesArray[virtualRow.index]
        if (!message) return null

        const previousMessage = messagesArray[virtualRow.index - 1]
        const showDateSeparator =
          virtualRow.index === 0 ||
          (previousMessage && isNewDay(message.created_at, previousMessage.created_at))
        const showUnreadIndicator =
          lastReadMessageId === message.id && (totalMsgSincLastRead ?? 0) >= 6

        const renderMessageContent = () => {
          if (message.type === 'notification') {
            if (!displaySystemNotifyChip) return null
            return <SystemNotifyChip message={message} />
          }

          if (children) {
            return children(message, virtualRow.index, messagesArray)
          }

          return <div className="message-item">{message.content}</div>
        }

        const content = renderMessageContent()

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={(node) => {
              virtualizer.measureElement(node)
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`
            }}>
            {showUnreadIndicator && <UnreadIndicatorLine index={virtualRow.index} />}
            {showDateSeparator && (
              <DateChip date={message.created_at} isScrollingUp={isScrollingUp} />
            )}
            {content}
          </div>
        )
      })}
    </div>
  )
}

export default MessageLoop
