import React, { memo, useCallback } from 'react'
import { ChatLeft } from '@icons'
import { useChatStore, useStore } from '@stores'
import { useModal } from '@components/ui/ModalDrawer'
import AvatarStack from '@components/AvatarStack'
import slugify from 'slugify'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'
import { usePresentUsers, useUnreadCount } from '../hooks'

interface DocTitleProps {
  className?: string
  variant?: 'desktop' | 'mobile'
}

const DocTitle = memo(({ className = '', variant = 'desktop' }: DocTitleProps) => {
  const { metadata: docMetadata, workspaceId } = useStore((state) => state.settings)
  const { headingId: activeChatId } = useChatStore((state) => state.chatRoom)
  const { close: closeModal } = useModal() || {}

  const unreadCount = useUnreadCount(workspaceId || '')
  const presentUsers = usePresentUsers(workspaceId || '')

  const isActive = activeChatId === workspaceId

  const handleClick = useCallback(() => {
    // Scroll to document title
    document
      .querySelector('.tiptap__editor.docy_editor .heading')
      ?.scrollIntoView({ behavior: 'smooth' })

    if (!workspaceId || !docMetadata?.title) return

    // Update URL
    const url = new URL(window.location.href)
    url.searchParams.set('h', slugify(docMetadata.title.toLowerCase().trim()))
    url.searchParams.set('id', workspaceId)
    window.history.replaceState({}, '', url)

    // Open chat
    PubSub.publish(CHAT_OPEN, { headingId: workspaceId })

    if (variant === 'mobile') {
      closeModal?.()
    }
  }, [workspaceId, docMetadata?.title, variant, closeModal])

  if (variant === 'mobile') {
    return (
      <div className={`${className} border-b border-gray-300`}>
        <div className="group relative flex items-center justify-between py-2">
          <span className="text-lg font-bold">{docMetadata?.title}</span>
          <span
            className="btn_openChatBox bg-neutral text-neutral-content flex items-center justify-end overflow-hidden"
            onClick={handleClick}
            data-unread-count={unreadCount > 0 ? unreadCount : ''}>
            <ChatLeft
              className={`chatLeft fill-neutral-content ${isActive && '!fill-accent'}`}
              size={14}
            />
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className} relative border-b border-gray-300 pb-1`}>
      <div
        className={`group flex cursor-pointer items-center justify-between rounded-md p-1 px-2 pr-3 hover:bg-gray-300 hover:bg-opacity-50 ${isActive && 'activeTocBorder bg-gray-300'}`}
        onClick={handleClick}>
        <span className="text-lg font-bold">{docMetadata?.title}</span>
        <span className="btn_chat tooltip tooltip-top relative ml-auto" data-tip="Chat Room">
          {unreadCount > 0 && (
            <div className="badge badge-docsy badge-sm bg-docsy border-docsy absolute top-1/2 z-[1] -translate-y-1/2 scale-90 border border-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
          <ChatLeft
            className={`btnChat ml-1 ${unreadCount > 0 && 'hidden'} group-hover:fill-docsy cursor-pointer transition-all hover:fill-indigo-900`}
            size={16}
          />
        </span>
        {presentUsers.length > 0 && (
          <div className="absolute -right-9">
            <AvatarStack size={8} users={presentUsers} showStatus tooltipPosition="tooltip-left" />
          </div>
        )}
      </div>
    </div>
  )
})

DocTitle.displayName = 'DocTitle'

export default DocTitle
