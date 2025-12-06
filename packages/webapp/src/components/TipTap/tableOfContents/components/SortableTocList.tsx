import React, { useCallback, useState, useMemo, memo, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CaretRight, ChatLeft } from '@icons'
import { MdDragIndicator } from 'react-icons/md'
import { useChatStore, useStore } from '@stores'
import AvatarStack from '@components/AvatarStack'
import PubSub from 'pubsub-js'
import { TIPTAP_EVENTS } from '@types'
import { useOpenChat, useScrollToHeading } from '../hooks'
import type { TocHeading } from '../types'

// =============================================================================
// Types
// =============================================================================

interface SortableTocItemProps {
  item: TocHeading
  hasChildren: boolean
  isOpen: boolean
  onToggleFold: (id: string) => void
  presentUsers: any[]
  unreadCount: number
  isDragging?: boolean
  showLevelIndicator?: boolean
  levelDelta?: number
}

interface SortableTocListProps {
  items: TocHeading[]
  onTocChange?: (updatedItems: TocHeading[]) => void
}

// =============================================================================
// Constants
// =============================================================================

const LEVEL_CHANGE_THRESHOLD = 30 // pixels of horizontal drag to change level
const MIN_LEVEL = 1
const MAX_LEVEL = 6

// =============================================================================
// SortableTocItem
// =============================================================================

const SortableTocItem = memo(
  ({
    item,
    hasChildren,
    isOpen,
    onToggleFold,
    presentUsers,
    unreadCount,
    isDragging = false,
    showLevelIndicator = false,
    levelDelta = 0
  }: SortableTocItemProps) => {
    const { headingId: activeChatId } = useChatStore((state) => state.chatRoom)
    const openChat = useOpenChat()
    const scrollToHeading = useScrollToHeading()

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging: isSortableDragging
    } = useSortable({ id: item.id })

    const isActive = activeChatId === item.id
    const isBeingDragged = isDragging || isSortableDragging

    const style: React.CSSProperties = {
      '--level': item.level,
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isSortableDragging ? 0.5 : 1,
      zIndex: isSortableDragging ? 100 : undefined
    } as React.CSSProperties

    const handleItemClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault()
        scrollToHeading(item.id)
        openChat(item.id)
      },
      [item.id, scrollToHeading, openChat]
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
        openChat(item.id, { focusEditor: true })
      },
      [item.id, openChat]
    )

    // Compute displayed level (with delta during drag)
    const displayLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, item.level + levelDelta))

    return (
      <li
        ref={setNodeRef}
        className={`toc__item relative w-full ${!isOpen ? 'closed' : ''} ${isBeingDragged ? 'dragging' : ''}`}
        data-id={item.id}
        data-level={item.level}
        data-dragging={isBeingDragged}
        style={style}>
        {/* Level indicator - shown during drag */}
        {showLevelIndicator && (
          <span
            className={`toc__levelBadge ${isBeingDragged ? 'active' : ''} ${levelDelta > 0 ? 'indent' : levelDelta < 0 ? 'outdent' : ''}`}>
            H{displayLevel}
          </span>
        )}

        <a
          className={`group relative ${isActive ? 'active activeTocBorder bg-gray-300' : ''}`}
          onClick={handleItemClick}
          href={`?${item.id}`}
          data-id={item.id}>
          {/* Drag handle */}
          <span className="toc__dragHandle" {...attributes} {...listeners}>
            <MdDragIndicator size={16} />
          </span>

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
              size={18}
            />
          </span>

          {presentUsers.length > 0 && (
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

SortableTocItem.displayName = 'SortableTocItem'

// =============================================================================
// Drag Overlay Item (shown while dragging)
// =============================================================================

const DragOverlayItem = memo(
  ({
    item,
    levelDelta,
    childCount
  }: {
    item: TocHeading
    levelDelta: number
    childCount: number
  }) => {
    const displayLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, item.level + levelDelta))

    return (
      <div className="toc__dragOverlay">
        <span className="toc__dragOverlay-level">
          H{displayLevel}
          {levelDelta > 0 && <span className="indent">+{levelDelta}</span>}
          {levelDelta < 0 && <span className="outdent">{levelDelta}</span>}
        </span>
        <span className="toc__dragOverlay-text">{item.text}</span>
        {childCount > 0 && <span className="toc__dragOverlay-count">+{childCount}</span>}
      </div>
    )
  }
)

DragOverlayItem.displayName = 'DragOverlayItem'

// =============================================================================
// SortableTocList
// =============================================================================

export const SortableTocList = memo(({ items, onTocChange }: SortableTocListProps) => {
  const [foldedIds, setFoldedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [levelDelta, setLevelDelta] = useState(0)
  const dragStartXRef = useRef<number>(0)

  // Batch lookups: get all presence and unread data at once
  const usersPresence = useStore((state) => state.usersPresence)
  const channels = useChatStore((state) => state.channels)

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Require 8px of movement before starting drag
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const toggleFold = useCallback((id: string) => {
    setFoldedIds((prev) => {
      const next = new Set(prev)
      const willBeFolded = !next.has(id)

      if (willBeFolded) {
        next.add(id)
      } else {
        next.delete(id)
      }

      PubSub.publish(TIPTAP_EVENTS.FOLD_AND_UNFOLD, {
        headingId: id,
        open: !willBeFolded
      })

      return next
    })
  }, [])

  // Compute visible items with presence/unread data
  const visibleItems = useMemo(() => {
    const result: {
      item: TocHeading
      hasChildren: boolean
      presentUsers: any[]
      unreadCount: number
    }[] = []
    let skipUntilLevel: number | null = null

    const allPresenceUsers = usersPresence ? Array.from(usersPresence.values()) : []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const nextItem = items[i + 1]
      const hasChildren = nextItem !== undefined && nextItem.level > item.level

      if (skipUntilLevel !== null && item.level > skipUntilLevel) {
        continue
      }

      skipUntilLevel = null

      const presentUsers = allPresenceUsers.filter(
        (user) => user?.channelId === item.id && user?.status !== 'OFFLINE'
      )

      const channel = channels.get(item.id)
      const rawCount = channel?.unread_message_count ?? 0
      const unreadCount = rawCount > 99 ? 99 : rawCount

      result.push({ item, hasChildren, presentUsers, unreadCount })

      if (foldedIds.has(item.id) && hasChildren) {
        skipUntilLevel = item.level
      }
    }

    return result
  }, [items, foldedIds, usersPresence, channels])

  // Get the active item being dragged
  const activeItem = useMemo(() => {
    if (!activeId) return null
    return items.find((item) => item.id === activeId) || null
  }, [activeId, items])

  // Count children of the active item (for overlay)
  const activeChildCount = useMemo(() => {
    if (!activeItem) return 0
    const activeIndex = items.findIndex((i) => i.id === activeItem.id)
    let count = 0
    for (let i = activeIndex + 1; i < items.length; i++) {
      if (items[i].level > activeItem.level) {
        count++
      } else {
        break
      }
    }
    return count
  }, [activeItem, items])

  // ==========================================================================
  // Drag Handlers
  // ==========================================================================

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setLevelDelta(0)
    // Store the initial X position for horizontal tracking
    const rect = (event.active.rect as any).current?.translated
    if (rect) {
      dragStartXRef.current = rect.left
    }
  }, [])

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!activeItem) return

      // Calculate horizontal movement
      const deltaX = event.delta.x

      // Calculate level change based on horizontal movement
      const newLevelDelta = Math.round(deltaX / LEVEL_CHANGE_THRESHOLD)

      // Clamp to valid range
      const clampedDelta = Math.max(
        MIN_LEVEL - activeItem.level,
        Math.min(MAX_LEVEL - activeItem.level, newLevelDelta)
      )

      if (clampedDelta !== levelDelta) {
        setLevelDelta(clampedDelta)
      }
    },
    [activeItem, levelDelta]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (!over) {
        setActiveId(null)
        setLevelDelta(0)
        return
      }

      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      if (oldIndex === -1 || newIndex === -1) {
        setActiveId(null)
        setLevelDelta(0)
        return
      }

      const activeItemData = items[oldIndex]

      // Collect children of the active item
      const childrenEndIndex = (() => {
        for (let i = oldIndex + 1; i < items.length; i++) {
          if (items[i].level <= activeItemData.level) {
            return i
          }
        }
        return items.length
      })()

      const itemsToMove = items.slice(oldIndex, childrenEndIndex)
      const remainingItems = [...items.slice(0, oldIndex), ...items.slice(childrenEndIndex)]

      // Calculate new position
      let insertIndex = remainingItems.findIndex((item) => item.id === over.id)
      if (insertIndex === -1) {
        insertIndex = remainingItems.length
      } else if (newIndex > oldIndex) {
        insertIndex += 1
      }

      // Apply level delta to moved items
      const updatedItemsToMove = itemsToMove.map((item, idx) => ({
        ...item,
        level: Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, item.level + levelDelta))
      }))

      // Reconstruct the list
      const updatedItems = [
        ...remainingItems.slice(0, insertIndex),
        ...updatedItemsToMove,
        ...remainingItems.slice(insertIndex)
      ]

      // Notify parent of changes
      if (onTocChange && (oldIndex !== newIndex || levelDelta !== 0)) {
        onTocChange(updatedItems)
      }

      setActiveId(null)
      setLevelDelta(0)
    },
    [items, levelDelta, onTocChange]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setLevelDelta(0)
  }, [])

  // Item IDs for sortable context
  const itemIds = useMemo(() => visibleItems.map(({ item }) => item.id), [visibleItems])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {visibleItems.map(({ item, hasChildren, presentUsers, unreadCount }) => (
          <SortableTocItem
            key={item.id}
            item={item}
            hasChildren={hasChildren}
            isOpen={!foldedIds.has(item.id)}
            onToggleFold={toggleFold}
            presentUsers={presentUsers}
            unreadCount={unreadCount}
            isDragging={activeId === item.id}
            showLevelIndicator={!!activeId}
            levelDelta={activeId === item.id ? levelDelta : 0}
          />
        ))}
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <DragOverlayItem
            item={activeItem}
            levelDelta={levelDelta}
            childCount={activeChildCount}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
})

SortableTocList.displayName = 'SortableTocList'

export default SortableTocList
