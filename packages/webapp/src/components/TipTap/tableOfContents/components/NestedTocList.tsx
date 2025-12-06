import React, { memo, useCallback, useState, useMemo, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
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

interface NestedTocListProps {
  items: TocHeading[]
  onTocChange?: (updatedItems: TocHeading[]) => void
}

interface TocItemProps {
  item: TocHeading
  onToggleFold: (id: string) => void
  hasChildren: boolean
  isOpen: boolean
  isDragging: boolean
  levelDelta: number
}

// =============================================================================
// Constants
// =============================================================================

const LEVEL_CHANGE_THRESHOLD = 40 // pixels to change one level
const MIN_LEVEL = 1
const MAX_LEVEL = 6

// =============================================================================
// Utility Functions
// =============================================================================

// Check if an item has children in the flat list
function hasChildrenInList(items: TocHeading[], index: number): boolean {
  if (index >= items.length - 1) return false
  return items[index + 1].level > items[index].level
}

// Get all descendants of an item (items with higher level immediately following)
function getDescendants(items: TocHeading[], index: number): TocHeading[] {
  const descendants: TocHeading[] = []
  const parentLevel = items[index].level

  for (let i = index + 1; i < items.length; i++) {
    if (items[i].level > parentLevel) {
      descendants.push(items[i])
    } else {
      break
    }
  }

  return descendants
}

// =============================================================================
// TocItem Component (Sortable)
// =============================================================================

const TocItem = memo(
  ({ item, onToggleFold, hasChildren, isOpen, isDragging, levelDelta }: TocItemProps) => {
    const { headingId: activeChatId } = useChatStore((state) => state.chatRoom)
    const openChat = useOpenChat()
    const scrollToHeading = useScrollToHeading()

    const presenceByHeading = useStore((state) => (state.settings as any).presence?.byHeading)
    const presentUsers = presenceByHeading?.[item.id] || []

    const chatUnreadCounts = useChatStore((state) => (state as any).unreadCounts)
    const unreadCount = chatUnreadCounts?.[item.id] || 0

    const isActive = activeChatId === item.id

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging: isSortableDragging
    } = useSortable({
      id: item.id
    })

    // Calculate display level with delta
    const displayLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, item.level + levelDelta))

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isSortableDragging ? 0.4 : 1,
      paddingLeft: `${(displayLevel - 1) * 1}rem`
    }

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
        e.preventDefault()
        e.stopPropagation()
        onToggleFold(item.id)
        PubSub.publish(TIPTAP_EVENTS.FOLD_AND_UNFOLD, { headingId: item.id })
      },
      [item.id, onToggleFold]
    )

    const handleChatClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        openChat(item.id)
      },
      [item.id, openChat]
    )

    return (
      <li ref={setNodeRef} style={style} className="relative" data-id={item.id}>
        {/* Level indicator - shown during drag */}
        {isDragging && (
          <span
            className={`absolute -top-1 right-1 rounded px-1.5 py-0.5 text-xs font-bold ${
              levelDelta > 0
                ? 'bg-success text-success-content'
                : levelDelta < 0
                  ? 'bg-warning text-warning-content'
                  : 'bg-base-300 text-base-content'
            }`}>
            H{displayLevel}
          </span>
        )}

        <a
          className={`group flex items-center gap-1 ${isActive ? 'active' : ''}`}
          onClick={handleItemClick}
          href={`?${item.id}`}>
          {/* Drag handle */}
          <span
            className="toc__drag flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-60"
            {...attributes}
            {...listeners}>
            <MdDragIndicator size={16} />
          </span>

          {/* Fold button - always reserve space */}
          <span
            className={`toc__fold flex-shrink-0 ${isOpen ? 'open' : ''} ${!hasChildren ? 'invisible' : ''}`}
            onClick={hasChildren ? handleToggleFold : undefined}>
            <CaretRight size={14} fill="currentColor" />
          </span>

          {/* Text */}
          <span className="min-w-0 flex-1 break-words">{item.text}</span>

          {/* Presence */}
          {presentUsers.length > 0 && <AvatarStack users={presentUsers.slice(0, 3)} size={16} />}

          {/* Chat */}
          <span className="toc__chat" onClick={handleChatClick}>
            {unreadCount > 0 ? (
              <span className="toc__unread">{unreadCount}</span>
            ) : (
              <ChatLeft size={14} />
            )}
          </span>
        </a>
      </li>
    )
  }
)

TocItem.displayName = 'TocItem'

// =============================================================================
// Drag Overlay
// =============================================================================

const DragOverlayContent = memo(
  ({ item, levelDelta }: { item: TocHeading; levelDelta: number }) => {
    const displayLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, item.level + levelDelta))

    return (
      <div className="rounded-btn border-primary bg-base-100 flex items-center gap-2 border-2 px-3 py-2 shadow-xl">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-bold ${
            levelDelta > 0
              ? 'bg-success text-success-content'
              : levelDelta < 0
                ? 'bg-warning text-warning-content'
                : 'bg-primary text-primary-content'
          }`}>
          H{displayLevel}
        </span>
        <span className="max-w-[200px] truncate font-medium">{item.text}</span>
        {levelDelta !== 0 && (
          <span className="text-xs opacity-60">
            {levelDelta > 0 ? `+${levelDelta}` : levelDelta} level
            {Math.abs(levelDelta) > 1 ? 's' : ''}
          </span>
        )}
      </div>
    )
  }
)

DragOverlayContent.displayName = 'DragOverlayContent'

// =============================================================================
// NestedTocList Component (Main)
// =============================================================================

const NestedTocList = memo(({ items, onTocChange }: NestedTocListProps) => {
  const [foldedIds, setFoldedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [levelDelta, setLevelDelta] = useState(0)
  const dragStartX = useRef<number>(0)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  // Compute which items have children and are open
  const itemMeta = useMemo(() => {
    const meta: Record<string, { hasChildren: boolean; isOpen: boolean }> = {}
    items.forEach((item, index) => {
      const hasChildren = hasChildrenInList(items, index)
      meta[item.id] = {
        hasChildren,
        isOpen: !foldedIds.has(item.id)
      }
    })
    return meta
  }, [items, foldedIds])

  // Compute visible items (respecting fold state)
  const visibleItems = useMemo(() => {
    const visible: TocHeading[] = []
    let skipUntilLevel = Infinity

    for (const item of items) {
      if (item.level > skipUntilLevel) {
        continue
      }

      skipUntilLevel = Infinity
      visible.push(item)

      if (foldedIds.has(item.id)) {
        skipUntilLevel = item.level
      }
    }

    return visible
  }, [items, foldedIds])

  const visibleIds = useMemo(() => visibleItems.map((item) => item.id), [visibleItems])

  const handleToggleFold = useCallback((id: string) => {
    setFoldedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setLevelDelta(0)
    dragStartX.current = (event.activatorEvent as PointerEvent)?.clientX || 0
  }, [])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const deltaX = event.delta.x
    const newLevelDelta = Math.round(deltaX / LEVEL_CHANGE_THRESHOLD)

    // Get the active item to check level bounds
    setLevelDelta(newLevelDelta)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      const currentLevelDelta = levelDelta

      setActiveId(null)
      setLevelDelta(0)

      if (!over) return

      const activeIndex = items.findIndex((item) => item.id === active.id)
      const overIndex = items.findIndex((item) => item.id === over.id)

      if (activeIndex === -1) return

      // Get the dragged item and its descendants
      const draggedItem = items[activeIndex]
      const descendants = getDescendants(items, activeIndex)

      // Calculate new level
      const newLevel = Math.max(
        MIN_LEVEL,
        Math.min(MAX_LEVEL, draggedItem.level + currentLevelDelta)
      )
      const levelChange = newLevel - draggedItem.level

      // Build the updated items array
      let updatedItems = [...items]

      // Apply level change to dragged item and its descendants
      if (levelChange !== 0) {
        updatedItems = updatedItems.map((item, idx) => {
          if (idx === activeIndex) {
            return { ...item, level: newLevel }
          }
          if (idx > activeIndex && idx <= activeIndex + descendants.length) {
            return {
              ...item,
              level: Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, item.level + levelChange))
            }
          }
          return item
        })
      }

      // Apply position change if moved to a different position
      if (active.id !== over.id && activeIndex !== overIndex) {
        // Remove the item and its descendants
        const itemsToMove = [
          updatedItems[activeIndex],
          ...descendants.map((_, i) => updatedItems[activeIndex + 1 + i])
        ]
        const withoutMoved = [
          ...updatedItems.slice(0, activeIndex),
          ...updatedItems.slice(activeIndex + 1 + descendants.length)
        ]

        // Find new position in the filtered array
        const newOverIndex = withoutMoved.findIndex((item) => item.id === over.id)
        const insertAt =
          newOverIndex >= 0
            ? overIndex > activeIndex
              ? newOverIndex + 1
              : newOverIndex
            : withoutMoved.length

        // Insert at new position
        updatedItems = [
          ...withoutMoved.slice(0, insertAt),
          ...itemsToMove,
          ...withoutMoved.slice(insertAt)
        ]
      }

      // Only call onTocChange if something changed
      if (levelChange !== 0 || active.id !== over.id) {
        onTocChange?.(updatedItems)
        console.info('[TOC] Updated structure:', updatedItems)
      }
    },
    [items, levelDelta, onTocChange]
  )

  const activeItem = useMemo(() => {
    if (!activeId) return null
    return items.find((item) => item.id === activeId) || null
  }, [activeId, items])

  if (items.length === 0) {
    return null
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}>
      <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
        <ul className="menu w-full p-0">
          {visibleItems.map((item) => (
            <TocItem
              key={item.id}
              item={item}
              onToggleFold={handleToggleFold}
              hasChildren={itemMeta[item.id]?.hasChildren || false}
              isOpen={itemMeta[item.id]?.isOpen || true}
              isDragging={activeId !== null}
              levelDelta={activeId === item.id ? levelDelta : 0}
            />
          ))}
        </ul>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem && <DragOverlayContent item={activeItem} levelDelta={levelDelta} />}
      </DragOverlay>
    </DndContext>
  )
})

NestedTocList.displayName = 'NestedTocList'

export default NestedTocList
