import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { isMessage } from '@components/chatroom/types/chat-items'
import {
  ContextMenu,
  contextMenuPanelClassName,
  useContextMenuContext
} from '@components/ui/ContextMenu'
import { useAuthStore, useChatStore } from '@stores'
import { TMsgRow } from '@types'
import React, { useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { MessageMenuReadStatus } from '../MessageCard/components/common/MessageMenuReadStatus'
import ContextMenuItems from '../MessageCard/components/MessageContextMenu/ContextMenuItems'
import type { MessageCardDesktopElement } from '../MessageCard/MessageCardContext'

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

/**
 * Desktop right-click affordance restored on top of the Virtuoso feed.
 * Message identity is read back off the stamped `msgId` DOM property,
 * then looked up through `listRef.current.data.findIndex` so we stay on
 * the Virtuoso-owned data store without a parallel id->row map.
 */
const ContextMenuReadStatus = ({ message }: { message: TMsgRow | null }) => {
  const { isOpen } = useContextMenuContext()
  if (!message) return null

  return (
    <MessageMenuReadStatus
      message={message}
      isOpen={isOpen}
      wrapper="MenuItem"
      className="px-2.5 py-2"
    />
  )
}

export const ChatListContextMenu = ({ children, className }: Props) => {
  const { channelId, variant, listRef } = useChatroomContext()
  const profile = useAuthStore((state) => state.profile)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [contextMenuState, setContextMenuState] = useState<{
    message: TMsgRow | null
    messageCardElement: Element | null
  }>({
    message: null,
    messageCardElement: null
  })

  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? null
  )

  const handleBeforeShow = useCallback(
    (_e: MouseEvent, target: EventTarget | null): Element | null => {
      const messageCard = target instanceof Element ? target?.closest('.msg_card') : null
      if (!messageCard) return null

      const messageId = (messageCard as MessageCardDesktopElement).msgId ?? null
      if (!messageId) return null

      // Virtuoso owns the active window; map over it to recover the row
      // without keeping a parallel store. The visitor returns the item
      // untouched so the list is not re-rendered.
      let foundRow: TMsgRow | null = null
      listRef.current?.data.map((item) => {
        if (!foundRow && isMessage(item) && item.row.id === messageId) {
          foundRow = item.row as unknown as TMsgRow
        }
        return item
      })
      if (!foundRow) return null

      if (!channelSettings?.isUserChannelMember) return null

      setContextMenuState({ message: foundRow, messageCardElement: messageCard })
      removeContextMenuActiveClass()
      messageCard.classList.add('context-menu-active')
      return messageCard
    },
    [channelSettings, listRef]
  )

  const handleContextMenuClose = useCallback(() => {
    removeContextMenuActiveClass()
    setContextMenuState({ message: null, messageCardElement: null })
  }, [])

  if (variant === 'mobile' || !profile) return <>{children}</>

  return (
    <div className={twMerge('flex min-h-0 w-full flex-1 flex-col', className)} ref={contextMenuRef}>
      <ContextMenu
        className={twMerge(contextMenuPanelClassName, 'absolute z-40 min-w-[12rem]')}
        parentRef={contextMenuRef}
        onBeforeShow={handleBeforeShow}
        onClose={handleContextMenuClose}>
        <ContextMenuItems message={contextMenuState?.message ?? null} />
        <ContextMenuReadStatus message={contextMenuState?.message ?? null} />
      </ContextMenu>
      {children}
    </div>
  )
}
