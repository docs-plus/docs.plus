import AvatarStack from '@components/AvatarStack'
import Button from '@components/ui/Button'
import { Tooltip } from '@components/ui/Tooltip'
import UnreadBadge from '@components/ui/UnreadBadge'
import { useSortable } from '@dnd-kit/sortable'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore, useStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useActiveHeading, usePresentUsers, useTocActions, useUnreadCount } from './hooks'
import { TOC_CLASSES } from './tocClasses'
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
  const editor = useStore((state) => state.settings.editor.instance)

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
    isFocused && TOC_CLASSES.itemFocused,
    isGhosted && 'is-ghosted',
    isDragging && 'is-dragging',
    hasChildren && 'has-children',
    hasPresentUsers && 'has-present-users'
  )

  const aClassName = twMerge(
    'group relative rounded has-drag-handle whitespace-pre-line hyphens-auto',
    isActive && `active ${TOC_CLASSES.activeBorder} bg-base-300`
  )

  return (
    <li
      ref={sortable.setNodeRef}
      className={liClassName}
      data-id={item.id}
      {...(presentUsersCount > 0 && { 'data-present-users-count': presentUsersCount })}>
      <a className={aClassName} onClick={handleClick} href={`?${item.id}`} data-id={item.id}>
        {/* Level badge - visible during drag */}
        <span className={TOC_CLASSES.levelBadge}>H{item.level}</span>

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
          startIcon={<Icons.gripVertical size={18} />}
        />

        {/* Level picker on hover */}
        {isHoveringHandle && !isDragging && (
          <div className={`toc-drag-levels ${TOC_CLASSES.levelPicker}`}>
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
              `${TOC_CLASSES.foldBtn} size-5 min-w-5 !p-0`,
              item.open ? 'opened' : 'closed'
            )}
            onClick={handleToggle}
            startIcon={<Icons.chevronRight size={18} className="text-base-content/80" />}
            tooltip="Toggle"
            tooltipPlacement="top"
          />
        )}

        {/* Heading text */}
        <span className="toc__link hyphens-auto whitespace-pre-line">{item.textContent}</span>

        {/* Chat button */}
        <Tooltip title="Chat Room" placement="left">
          <span
            className={`${TOC_CLASSES.chatTrigger} relative ml-auto size-5 min-w-5`}
            data-heading-id={item.id}
            onClick={handleChatClick}>
            {unreadCount > 0 ? (
              <UnreadBadge count={unreadCount} size="sm" />
            ) : (
              <Icons.chatroom
                className={`${TOC_CLASSES.chatIcon} text-base-content/40 group-hover:text-primary hover:text-primary cursor-pointer transition-colors`}
                size={20}
              />
            )}
          </span>
        </Tooltip>

        {/* Present users */}
        {hasPresentUsers && (
          <div className="absolute -right-6">
            <AvatarStack
              maxDisplay={4}
              size="sm"
              users={presentUsers}
              showStatus={true}
              tooltipPosition="left"
            />
          </div>
        )}
      </a>

      {/* Nested children */}
      {hasChildren && (
        <ul className={twMerge(TOC_CLASSES.children, !item.open && 'hidden')}>
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
