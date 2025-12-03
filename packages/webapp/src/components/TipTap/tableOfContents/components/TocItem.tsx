import React, { useCallback, useState, useMemo, memo } from 'react'
import { CaretRight, ChatLeft } from '@icons'
import { useChatStore, useStore } from '@stores'
import AvatarStack from '@components/AvatarStack'
import PubSub from 'pubsub-js'
import { TIPTAP_EVENTS } from '@types'
import { useOpenChat, useScrollToHeading } from '../hooks'
import type { TocHeading } from '../types'

interface TocItemProps {
  item: TocHeading
  hasChildren: boolean
  isOpen: boolean
  onToggleFold: (id: string) => void
  presentUsers: any[]
  unreadCount: number
  variant?: 'desktop' | 'mobile'
  onNavigate?: () => void
}

/**
 * Single TOC item - uses CSS `--level` variable for indentation.
 * Flat structure following tiptap's recommended approach.
 * Performance: presence/unread data passed from parent to avoid per-item hook calls.
 */
const TocItem = memo(
  ({
    item,
    hasChildren,
    isOpen,
    onToggleFold,
    presentUsers,
    unreadCount,
    variant = 'desktop',
    onNavigate
  }: TocItemProps) => {
    const { headingId: activeChatId } = useChatStore((state) => state.chatRoom)
    const openChat = useOpenChat()
    const scrollToHeading = useScrollToHeading()

    const isActive = activeChatId === item.id

    const handleItemClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault()
        scrollToHeading(item.id)

        if (variant === 'desktop') {
          openChat(item.id)
        }

        onNavigate?.()
      },
      [item.id, scrollToHeading, openChat, variant, onNavigate]
    )

    const handleToggleFold = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        onToggleFold(item.id)
      },
      [item.id, onToggleFold]
    )

    const handleChatClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        openChat(item.id, { focusEditor: variant === 'desktop' })
        onNavigate?.()
      },
      [item.id, openChat, variant, onNavigate]
    )

    return (
      <li
        className={`toc__item relative w-full ${!isOpen ? 'closed' : ''}`}
        data-id={item.id}
        style={{ '--level': item.level } as React.CSSProperties}>
        <a
          className={`group relative ${isActive ? 'active activeTocBorder bg-gray-300' : ''}`}
          onClick={handleItemClick}
          href={`?${item.id}`}
          data-id={item.id}>
          {hasChildren && (
            <span
              className={`btnFold tooltip tooltip-top ${isOpen ? 'opened' : 'closed'}`}
              onClick={handleToggleFold}
              data-tip="Toggle">
              <CaretRight size={17} fill="#363636" />
            </span>
          )}

          <span className="toc__link wrap-anywhere">{item.text}</span>

          <span
            className="btn_chat tooltip tooltip-top relative ml-auto"
            onClick={handleChatClick}
            data-tip="Chat Room">
            {unreadCount > 0 && (
              <div className="badge badge-docsy badge-sm bg-docsy border-docsy absolute top-1/2 z-[1] -translate-y-1/2 scale-90 border border-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
            <ChatLeft
              className={`btnChat ${unreadCount > 0 && 'hidden'} group-hover:fill-docsy cursor-pointer transition-all hover:fill-indigo-900`}
              size={variant === 'desktop' ? 18 : 14}
            />
          </span>

          {variant === 'desktop' && presentUsers.length > 0 && (
            <div className="absolute -right-5">
              <AvatarStack
                size={8}
                users={presentUsers}
                showStatus
                tooltipPosition="tooltip-left"
              />
            </div>
          )}
        </a>
      </li>
    )
  }
)

TocItem.displayName = 'TocItem'

interface TocListProps {
  items: TocHeading[]
  variant?: 'desktop' | 'mobile'
  onNavigate?: () => void
}

/**
 * Flat list of TOC items with fold/crinkle support.
 * Performance optimizations:
 * - Batch presence/unread lookups (computed once, passed down)
 * - Single useMemo for visible items + metadata
 */
export const TocList = memo(({ items, variant = 'desktop', onNavigate }: TocListProps) => {
  const [foldedIds, setFoldedIds] = useState<Set<string>>(new Set())

  // Batch lookups: get all presence and unread data at once
  const usersPresence = useStore((state) => state.usersPresence)
  const channels = useChatStore((state) => state.channels)

  const toggleFold = useCallback((id: string) => {
    setFoldedIds((prev) => {
      const next = new Set(prev)
      const willBeFolded = !next.has(id)

      if (willBeFolded) {
        next.add(id)
      } else {
        next.delete(id)
      }

      // Publish event to editor to fold/unfold the heading content
      PubSub.publish(TIPTAP_EVENTS.FOLD_AND_UNFOLD, {
        headingId: id,
        open: !willBeFolded
      })

      return next
    })
  }, [])

  // Compute visible items with presence/unread data in single pass
  const visibleItems = useMemo(() => {
    const result: {
      item: TocHeading
      hasChildren: boolean
      presentUsers: any[]
      unreadCount: number
    }[] = []
    let skipUntilLevel: number | null = null

    // Pre-compute presence users array once
    const allPresenceUsers = usersPresence ? Array.from(usersPresence.values()) : []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const nextItem = items[i + 1]

      // Check if this item has children (next item has deeper level)
      const hasChildren = nextItem !== undefined && nextItem.level > item.level

      // Skip items that are hidden due to parent being folded
      if (skipUntilLevel !== null && item.level > skipUntilLevel) {
        continue
      }

      // Reset skip when we reach same or shallower level
      skipUntilLevel = null

      // Get presence users for this heading (filtered from batch)
      const presentUsers = allPresenceUsers.filter(
        (user) => user?.channelId === item.id && user?.status !== 'OFFLINE'
      )

      // Get unread count for this heading
      const channel = channels.get(item.id)
      const rawCount = channel?.unread_message_count ?? 0
      const unreadCount = rawCount > 99 ? 99 : rawCount

      result.push({ item, hasChildren, presentUsers, unreadCount })

      // If this item is folded and has children, skip its children
      if (foldedIds.has(item.id) && hasChildren) {
        skipUntilLevel = item.level
      }
    }

    return result
  }, [items, foldedIds, usersPresence, channels])

  return (
    <>
      {visibleItems.map(({ item, hasChildren, presentUsers, unreadCount }) => (
        <TocItem
          key={item.id}
          item={item}
          hasChildren={hasChildren}
          isOpen={!foldedIds.has(item.id)}
          onToggleFold={toggleFold}
          presentUsers={presentUsers}
          unreadCount={unreadCount}
          variant={variant}
          onNavigate={onNavigate}
        />
      ))}
    </>
  )
})

TocList.displayName = 'TocList'

export default TocItem
