import AvatarStack from '@components/AvatarStack'
import Button from '@components/ui/Button'
import UnreadBadge from '@components/ui/UnreadBadge'
import { useSortable } from '@dnd-kit/sortable'
import { ChatLeft } from '@icons'
import { useChatStore, useFocusedHeadingStore, useStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { useCallback, useMemo, useState } from 'react'
import { MdKeyboardArrowRight, MdOutlineDragIndicator } from 'react-icons/md'
import { twMerge } from 'tailwind-merge'

import { useActiveHeading, usePresentUsers, useTocActions, useUnreadCount } from './hooks'
import { buildNestedToc, scrollToHeading } from './utils'

interface TocItemDesktopProps {
  item: TocItemType
  childItems: TocItemType[]
  onToggle: (id: string) => void
  activeId?: string | null
  collapsedIds?: Set<string>
}

export function TocItemDesktop({
  item,
  childItems,
  onToggle,
  activeId = null,
  collapsedIds = new Set()
}: TocItemDesktopProps) {
  const sortable = useSortable({
    id: item.id,
    disabled: collapsedIds.has(item.id)
  })

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

  const isActive = headingId === item.id
  const hasChildren = childItems.length > 0
  const hasPresentUsers = useMemo(() => presentUsers.length > 0, [presentUsers])
  const presentUsersCount = useMemo(() => presentUsers.length, [presentUsers])

  // Drag state
  const isDragging = sortable.isDragging
  const isDescendantOfDragged = activeId ? collapsedIds.has(item.id) : false
  const isGhosted = isDragging || isDescendantOfDragged

  // Hover state for level picker
  const [isHoveringHandle, setIsHoveringHandle] = useState(false)

  const setFocusedHeadingWithLock = useFocusedHeadingStore((s) => s.setFocusedHeadingWithLock)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!editor) return

      setActiveHeading(item.id)
      setFocusedHeadingWithLock(item.id) // Lock focus during smooth scroll
      scrollToHeading(editor, item.id, { openChatRoom: true })
    },
    [editor, item.id, setActiveHeading, setFocusedHeadingWithLock]
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
      openChatroom(item.id, { focusEditor: true })
    },
    [item.id, openChatroom]
  )

  if (!editor) return null

  const nestedChildren = buildNestedToc(childItems)

  const liClassName = twMerge(
    'toc__item relative w-full',
    !item.open && 'closed',
    isFocused && 'focusSight',
    isGhosted && 'is-ghosted',
    isDragging && 'is-dragging',
    hasChildren && 'has-children',
    hasPresentUsers && 'has-present-users'
  )

  const aClassName = twMerge(
    'group relative rounded has-drag-handle whitespace-pre-line hyphens-auto',
    isActive && 'active activeTocBorder bg-gray-300'
  )

  return (
    <li
      ref={sortable.setNodeRef}
      className={liClassName}
      data-id={item.id}
      {...(presentUsersCount > 0 && { 'data-present-users-count': presentUsersCount })}>
      <a className={aClassName} onClick={handleClick} href={`?${item.id}`} data-id={item.id}>
        {/* Level badge - visible during drag */}
        <span className="toc-item-level">H{item.level}</span>

        {/* Drag handle */}
        <Button
          variant="ghost"
          size="xs"
          shape="square"
          className="toc-drag-handle absolute -left-4 size-5 min-w-5 !p-0"
          {...sortable.attributes}
          {...sortable.listeners}
          onMouseEnter={() => setIsHoveringHandle(true)}
          onMouseLeave={() => setIsHoveringHandle(false)}
          startIcon={<MdOutlineDragIndicator size={18} />}
        />

        {/* Level picker on hover */}
        {isHoveringHandle && !isDragging && (
          <div className="toc-drag-levels toc-hover-levels">
            {Array.from({ length: 6 }, (_, i) => i + 1)
              .filter(
                (level) =>
                  level >= Math.max(1, item.level - 3) && level <= Math.min(6, item.level + 3)
              )
              .map((level) => (
                <span
                  key={level}
                  className={`toc-drag-level ${level === item.level ? 'active' : ''} ${level === item.level ? 'original' : ''}`}>
                  H{level}
                </span>
              ))}
          </div>
        )}

        {/* Fold/Unfold button - only show if has children */}
        {hasChildren && (
          <Button
            variant="ghost"
            size="xs"
            shape="square"
            className={twMerge(
              'btnFold tooltip tooltip-top size-5 min-w-5 !p-0',
              item.open ? 'opened' : 'closed'
            )}
            onClick={handleToggle}
            data-tip="Toggle"
            startIcon={<MdKeyboardArrowRight size={18} fill="#363636" />}
          />
        )}

        {/* Heading text */}
        <span className="toc__link hyphens-auto whitespace-pre-line">{item.textContent}</span>

        {/* Chat button */}
        <span
          className="btn_chat tooltip tooltip-left relative ml-auto size-5 min-w-5"
          onClick={handleChatClick}
          data-tip="Chat Room">
          {unreadCount > 0 ? (
            <UnreadBadge count={unreadCount} size="sm" />
          ) : (
            <ChatLeft
              className="btnChat group-hover:fill-docsy cursor-pointer transition-all hover:fill-indigo-900"
              size={18}
            />
          )}
        </span>

        {/* Present users */}
        {hasPresentUsers && (
          <div className="absolute -right-6">
            <AvatarStack
              maxDisplay={4}
              size="sm"
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
            <TocItemDesktop
              key={childItem.id}
              item={childItem}
              childItems={grandChildren}
              onToggle={onToggle}
              activeId={activeId}
              collapsedIds={collapsedIds}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
