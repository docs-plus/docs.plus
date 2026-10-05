import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { isMessage } from '@components/chatroom/types/chat-items'
import { ContextMenu } from '@components/ui/ContextMenu'
import { useAuthStore, useChatStore } from '@stores'
import { TMsgRow } from '@types'
import { twMerge } from '@utils/twMerge'
import React, { useCallback, useRef, useState } from 'react'

import { UserReadStatus } from '../MessageCard/components/common/UserReadStatus'
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

/** Desktop right-click menu over the Virtuoso feed; the row comes from Virtuoso's own data. */
export const ChatListContextMenu = ({ children, className }: Props) => {
  const { channelId, variant, listRef } = useChatroomContext()
  const profile = useAuthStore((state) => state.profile)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState<TMsgRow | null>(null)

  const channelSettings = useChatStore(
    (state) => state.workspaceSettings.channels.get(channelId) ?? null
  )

  const handleBeforeShow = useCallback(
    (target: Element): Element | null => {
      const messageCard = target.closest('.msg_card')
      if (!messageCard) return null

      const messageId = (messageCard as MessageCardDesktopElement).msgId ?? null
      if (!messageId) return null
      if (!channelSettings?.isUserChannelMember) return null

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

      setMessage(foundRow)
      removeContextMenuActiveClass()
      messageCard.classList.add('context-menu-active')
      return messageCard
    },
    [channelSettings, listRef]
  )

  const handleContextMenuClose = useCallback(() => {
    removeContextMenuActiveClass()
    setMessage(null)
  }, [])

  if (variant === 'mobile' || !profile) return <>{children}</>

  return (
    <div className={twMerge('flex min-h-0 w-full flex-1 flex-col', className)} ref={contextMenuRef}>
      <ContextMenu
        aria-label="Message options"
        parentRef={contextMenuRef}
        onBeforeShow={handleBeforeShow}
        onClose={handleContextMenuClose}>
        <ContextMenuItems message={message} />
        {message && <UserReadStatus message={message} />}
      </ContextMenu>
      {children}
    </div>
  )
}
