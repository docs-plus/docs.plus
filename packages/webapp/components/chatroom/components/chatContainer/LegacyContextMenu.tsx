import React, { useCallback, useState } from 'react'
import { ContextMenu } from '../ui/ContextMenu'
import { ContextMenuItems } from '../MessageCard/components/MessageContextMenu/components/ContextMenuItems'
import { UserReadStatus } from '../MessageCard/components/MessageContextMenu/components/UserReadStatus'
import { MessageCardProvider } from '../MessageCard/MessageCardContext'
import { useChatStore } from '@stores'
import { useMemo } from 'react'
import { TChannelSettings } from '@types'
import { twMerge } from 'tailwind-merge'
import { TMsgRow } from '@types'

type Props = {
  children: React.ReactNode
  className?: string
  channelId: string
  messages: Map<string, TMsgRow>
}

export const LegacyContextMenu = ({ children, className, channelId, messages }: Props) => {
  const channels = useChatStore((state) => state.workspaceSettings.channels)

  // Context menu state
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean
    message: TMsgRow | null
    index: number
  }>({
    isOpen: false,
    message: null,
    index: -1
  })

  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  // Handle right-click on message cards
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      // Find the message card element
      const messageCard = e.target instanceof Element ? e.target.closest('[data-message-id]') : null

      if (!messageCard) return

      const messageId = messageCard.getAttribute('data-message-id')
      if (!messageId || !messages) return

      // Get message from the messages Map
      const message = messages.get(messageId)
      if (!message) return

      // Find the index of the message
      const messagesArray = Array.from(messages.values())
      const index = messagesArray.findIndex((msg) => msg.id === messageId)

      setContextMenuState({
        isOpen: true,
        message,
        index
      })
    },
    [messages]
  )

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState({
      isOpen: false,
      message: null,
      index: -1
    })
  }, [])

  // Don't show context menu if user is not a member of the channel
  const shouldShowContextMenu = channelSettings?.isUserChannelMember && contextMenuState.message

  return (
    <div onContextMenu={handleContextMenu} className={className}>
      {children}

      {shouldShowContextMenu && contextMenuState.message && (
        <MessageCardProvider message={contextMenuState.message} index={contextMenuState.index}>
          <ContextMenu
            className={twMerge('menu bg-base-100 z-20 m-0 w-48 rounded-lg p-2 shadow outline-none')}
            parrentRef={{
              current: document.querySelector(`[data-message-id="${contextMenuState.message.id}"]`)
            }}>
            <ContextMenuItems />
            <UserReadStatus />
          </ContextMenu>
        </MessageCardProvider>
      )}
    </div>
  )
}
