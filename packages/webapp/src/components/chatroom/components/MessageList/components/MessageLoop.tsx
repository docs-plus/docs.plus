import { useAuthStore, useChatStore } from '@stores'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { TGroupedMsgRow, TMsgRow } from '@types'
import { projectMessageGroups } from '@utils/projectMessageGroups'
import { isSameDay, parseISO } from 'date-fns'
import React, { useCallback, useEffect, useMemo } from 'react'

import { useMessageListContext } from '../MessageListContext'
import { DateChip } from './DateChip'
import { SystemNotifyChip } from './SystemNotifyChip'
import { UnreadIndicatorLine } from './UnreadIndicatorLine'

interface Props {
  children?: (message: TGroupedMsgRow, index: number, messages: TGroupedMsgRow[]) => React.ReactNode
  displaySystemNotifyChip?: boolean
}

const isNewDay = (currentMessageDate: string, previousMessageDate: string) => {
  return !isSameDay(parseISO(currentMessageDate), parseISO(previousMessageDate))
}

type NotificationMetadata = { type?: string }
const getNotificationType = (m: TMsgRow): string | undefined =>
  (m.metadata as NotificationMetadata | null)?.type

export const MessageLoop = ({ children, displaySystemNotifyChip = true }: Props) => {
  const {
    messagesArray: rawMessages,
    channelId,
    messageContainerRef,
    registerVirtualizer
  } = useMessageListContext()

  const currentUserId = useAuthStore((state) => state.profile?.id ?? null)

  const messagesArray = useMemo(
    () => projectMessageGroups(rawMessages, currentUserId),
    [rawMessages, currentUserId]
  )

  // Two leaf selectors instead of one channel-settings object so that
  // unrelated property changes on this channel don't re-render the loop.
  const lastReadMessageId = useChatStore(
    (state: any) => state.workspaceSettings.channels.get(channelId)?.lastReadMessageId ?? ''
  )
  const totalMsgSinceLastRead = useChatStore(
    (state: any) => state.workspaceSettings.channels.get(channelId)?.totalMsgSinceLastRead ?? 0
  )

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
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
      {virtualItems.map((virtualRow) => {
        const message = messagesArray[virtualRow.index]
        if (!message) return null

        const previousMessage = messagesArray[virtualRow.index - 1]
        const showDateSeparator =
          virtualRow.index === 0 ||
          (previousMessage && isNewDay(message.created_at, previousMessage.created_at))
        const notifType = getNotificationType(message)
        const showUnreadIndicator =
          lastReadMessageId === message.id && (totalMsgSinceLastRead ?? 0) >= 6

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
            {showDateSeparator &&
              notifType !== 'channel_created' &&
              notifType !== 'user_join_workspace' && <DateChip date={message.created_at} />}
            {content}
          </div>
        )
      })}
    </div>
  )
}

export default MessageLoop
