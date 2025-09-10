import React, { useMemo } from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { useStore, useChatStore } from '@stores'
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
  const { messages, channelId, isScrollingUp, messagesEndRef } = useMessageListContext()

  const messagesArray = useMemo(() => {
    const array = messages ? Array.from(messages.values()) : []
    return array
  }, [messages])

  // Get channel settings for unread indicator
  const channelSettings = useChatStore((state: any) =>
    state.workspaceSettings.channels.get(channelId)
  )
  const { lastReadMessageId, totalMsgSincLastRead } = channelSettings || {
    lastReadMessageId: '',
    totalMsgSincLastRead: 0
  }

  const messageElements = useMemo(() => {
    return messagesArray.flatMap((message, index, array) => {
      const elements: React.ReactElement[] = []

      // Unread messages divider
      if (lastReadMessageId === message.id && (totalMsgSincLastRead ?? 0) >= 6) {
        elements.push(<UnreadIndicatorLine index={index} />)
      }

      // Date separator
      if (index === 0 || isNewDay(message.created_at, array[index - 1]?.created_at)) {
        elements.push(
          <DateChip
            key={`date-chip-${message.created_at}`}
            date={message.created_at}
            isScrollingUp={isScrollingUp}
          />
        )
      }

      // Message content
      if (message.type === 'notification') {
        if (displaySystemNotifyChip) {
          elements.push(<SystemNotifyChip key={message.id} message={message} />)
        }
      } else {
        // Use children render prop or default rendering
        const messageElement = children ? (
          children(message, index, array)
        ) : (
          <div key={message.id} className="message-item">
            {message.content}
          </div>
        )

        // Add ref to last message
        const isLastMessage = index === array.length - 1
        elements.push(
          <div key={message.id} ref={isLastMessage ? messagesEndRef : null}>
            {messageElement}
          </div>
        )
      }

      return elements
    })
  }, [
    messagesArray,
    isScrollingUp,
    lastReadMessageId,
    totalMsgSincLastRead,
    displaySystemNotifyChip,
    children,
    messagesEndRef
  ])

  return <>{messageElements}</>
}

export default MessageLoop
