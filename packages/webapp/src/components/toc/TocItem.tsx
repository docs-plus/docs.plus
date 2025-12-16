import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { twMerge } from 'tailwind-merge'
import { CaretRight, ChatLeft } from '@icons'
import { useStore, useChatStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import {
  useTocActions,
  usePresentUsers,
  useUnreadCount,
  useActiveHeading,
  useFocusedHeadingStore
} from './hooks'
import { scrollToHeading, buildNestedToc } from './utils'
import { useModal } from '@components/ui/ModalDrawer'
import AvatarStack from '@components/AvatarStack'
import { MdDragIndicator } from 'react-icons/md'

interface TocItemProps {
  item: TocItemType
  children: TocItemType[]
  variant: 'desktop' | 'mobile'
  onToggle: (id: string) => void
  // Optional DnD props - only used when draggable
  draggable?: boolean
  activeId?: string | null
  collapsedIds?: Set<string>
}

export function TocItem({
  item,
  children,
  variant,
  onToggle,
  draggable = false,
  activeId = null,
  collapsedIds = new Set()
}: TocItemProps) {
  // Only use sortable when draggable
  const sortable = draggable
    ? useSortable({ id: item.id, disabled: collapsedIds.has(item.id) })
    : null

  const { headingId } = useChatStore((state) => state.chatRoom)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const focusedHeadingId = useFocusedHeadingStore((s) => s.focusedHeadingId)
  const isFocused = focusedHeadingId === item.id

  const presentUsers = usePresentUsers(item.id)
  const [, setActiveHeading] = useActiveHeading()
  const unreadCount = useUnreadCount(item.id)
  const { openChatroom } = useTocActions()
  const modal = variant === 'mobile' ? useModal() : null

  const isActive = headingId === item.id
  const hasChildren = children.length > 0

  // Drag state
  const isDragging = sortable?.isDragging ?? false
  const isDescendantOfDragged = activeId ? collapsedIds.has(item.id) : false
  const isGhosted = isDragging || isDescendantOfDragged

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!editor) return

      setActiveHeading(item.id)
      scrollToHeading(editor, item.id, { openChatRoom: variant === 'desktop' })

      if (variant === 'mobile') {
        modal?.close?.()
      }
    },
    [editor, item.id, variant, setActiveHeading, modal]
  )

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onToggle(item.id)
    },
    [item.id, onToggle]
  )

  const handleChatClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      openChatroom(item.id, { focusEditor: variant === 'desktop' })
      if (variant === 'mobile') {
        modal?.close?.()
      }
    },
    [item.id, variant, openChatroom, modal]
  )

  if (!editor) return null

  const nestedChildren = buildNestedToc(children)

  // Build class names
  const liClassName = twMerge(
    'toc__item relative w-full',
    !item.open && 'closed',
    isFocused && 'focusSight',
    isGhosted && 'is-ghosted',
    isDragging && 'is-dragging'
  )

  const aClassName = twMerge(
    'group relative',
    isActive && 'active activeTocBorder bg-gray-300',
    draggable && 'has-drag-handle',
    variant === 'mobile' && '!py-2',
    variant === 'mobile' && item.level === 1 && 'ml-3'
  )

  return (
    <li ref={sortable?.setNodeRef} className={liClassName} data-id={item.id}>
      <a className={aClassName} onClick={handleClick} href={`?${item.id}`} data-id={item.id}>
        {/* Level badge - visible during drag (desktop only) */}
        {draggable && <span className="toc-item-level">H{item.level}</span>}

        {/* Drag handle (desktop only) */}
        {draggable && sortable && (
          <button
            type="button"
            className="toc-drag-handle"
            {...sortable.attributes}
            {...sortable.listeners}>
            <MdDragIndicator size={16} />
          </button>
        )}

        {/* Fold/Unfold button */}
        <span
          className={twMerge('btnFold tooltip tooltip-top', item.open ? 'opened' : 'closed')}
          onClick={handleToggle}
          data-tip="Toggle">
          <CaretRight size={17} fill="#363636" />
        </span>

        {/* Heading text */}
        <span className="toc__link wrap-anywhere">{item.textContent}</span>

        {/* Chat button */}
        {variant === 'desktop' ? (
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
              className={twMerge(
                'btnChat group-hover:fill-docsy cursor-pointer transition-all hover:fill-indigo-900',
                unreadCount > 0 && 'hidden'
              )}
              size={18}
            />
          </span>
        ) : (
          <>
            <span className="block w-8 pl-8" />
            <span
              className="btn_openChatBox bg-neutral text-neutral-content flex items-center justify-end overflow-hidden"
              onClick={handleChatClick}
              data-unread-count={unreadCount > 0 ? unreadCount : ''}>
              <ChatLeft
                className={twMerge('chatLeft fill-neutral-content', isActive && '!fill-accent')}
                size={14}
              />
            </span>
          </>
        )}

        {/* Present users (desktop only) */}
        {variant === 'desktop' && presentUsers.length > 0 && (
          <div className="absolute -right-5">
            <AvatarStack
              size={8}
              users={presentUsers}
              showStatus={true}
              tooltipPosition="tooltip-left"
            />
          </div>
        )}
      </a>

      {/* Nested children */}
      {hasChildren && (
        <ul className={twMerge('childrenWrapper', !item.open && 'hidden')}>
          {nestedChildren.map(({ item: childItem, children: grandChildren }) => (
            <TocItem
              key={childItem.id}
              item={childItem}
              children={grandChildren}
              variant={variant}
              onToggle={onToggle}
              draggable={draggable}
              activeId={activeId}
              collapsedIds={collapsedIds}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
