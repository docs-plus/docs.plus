import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { ContextMenu } from '@components/ui/ContextMenu'
import { useAuthStore, useChatStore } from '@stores'
import { TChannelSettings } from '@types'
import { TMsgRow } from '@types'
import React, { useCallback, useRef, useState } from 'react'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

import ContextMenuItems from '../../MessageCard/components/MessageContextMenu/ContextMenuItems'
import UserReadStatus from '../../MessageCard/components/MessageContextMenu/UserReadStatus'
import type { MessageCardDesktopElement } from '../../MessageCard/MessageCardContext'
import { useMessageListContext } from '../MessageListContext'

type Props = {
  children: React.ReactNode
  className?: string
}

const removeContextMenuActiveClass = () => {
  const messageCards = document.querySelectorAll('.msg_card.context-menu-active')
  messageCards.forEach((card: Element) => {
    card.classList.remove('context-menu-active')
  })
}

export const MessageListContextMenu = ({ children, className }: Props) => {
  const { variant } = useChatroomContext()
  const profile = useAuthStore((state) => state.profile)
  const { channelId, messages } = useMessageListContext()
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [contextMenuState, setContextMenuState] = useState<{
    message: TMsgRow | null
    messageCardElement: Element | null
  }>({
    message: null,
    messageCardElement: null
  })

  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  // Handle the onBeforeShow event to inspect the target and decide what to show
  const handleBeforeShow = useCallback(
    (e: MouseEvent, target: EventTarget | null): Element | null => {
      // Find the message card element from the target
      const messageCard = target instanceof Element ? target?.closest('.msg_card') : null

      if (!messageCard) return null

      // MessageCard / SystemNotifyChip stamp identity directly onto the
      // .msg_card DOM node (cardRef.current.msgId = …) — read it back as
      // a typed property, no HTML data-attribute round-trip.
      const messageId = (messageCard as MessageCardDesktopElement).msgId ?? null
      if (!messageId || !messages) return null

      // Get message from the messages Map
      const message = messages.get(messageId)
      if (!message) return null

      // Only show context menu if user is a member of the channel
      if (!channelSettings?.isUserChannelMember) return null

      // Set the current message context and store the element
      setContextMenuState({
        message,
        messageCardElement: messageCard
      })

      removeContextMenuActiveClass()

      // Add CSS class to highlight the message card
      messageCard.classList.add('context-menu-active')

      // Return the messageCard element to use as the target for the context menu
      return messageCard
    },
    [messages, channelSettings]
  )

  // Handle cleanup when context menu closes
  const handleContextMenuClose = useCallback(() => {
    removeContextMenuActiveClass()
    setContextMenuState({
      message: null,
      messageCardElement: null
    })
  }, [])

  if (variant === 'mobile' || !profile) return children

  return (
    // Pass-through wrapper: layout ownership lives in MessageList; we just keep
    // the flex chain alive so Virtuoso's `height:100%` has a sized parent.
    <div className={twMerge('flex min-h-0 w-full flex-1 flex-col', className)} ref={contextMenuRef}>
      <ContextMenu
        className={twMerge(
          'menu bg-base-100 absolute z-20 m-0 w-48 rounded-lg p-2 shadow outline-none'
        )}
        parrentRef={contextMenuRef}
        onBeforeShow={handleBeforeShow}
        onClose={handleContextMenuClose}>
        <ContextMenuItems message={contextMenuState?.message ?? null} />
        <div className="border-base-300 mt-1 border-t pt-1">
          <UserReadStatus message={contextMenuState?.message ?? null} />
        </div>
      </ContextMenu>
      {children}
    </div>
  )
}
