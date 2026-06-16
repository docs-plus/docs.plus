import AvatarStack from '@components/AvatarStack'
import Button from '@components/ui/Button'
import { Tooltip } from '@components/ui/Tooltip'
import { useSortable } from '@dnd-kit/sortable'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore, useStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { chatTriggerAriaLabel, ChatTriggerContent } from './ChatTriggerContent'
import { useActiveHeading, usePresentUsers, useTocActions, useUnreadCount } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocLevelPicker } from './TocLevelPicker'
import { type NestedTocNode, scrollToHeading, tocTrailingRailPx } from './utils'

interface TocItemDesktopProps {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
  activeId?: string | null
  collapsedIds?: Set<string>
}

export function TocItemDesktop({
  item,
  nestedNodes,
  onToggle,
  activeId = null,
  collapsedIds = new Set()
}: TocItemDesktopProps) {
  const sortable = useSortable({
    id: item.id,
    disabled: collapsedIds.has(item.id)
  })

  const headingId = useChatStore((state) => state.chatRoom.headingId)
  const editor = useStore((state) => state.settings.editor.instance)

  const focusedHeadingId = useFocusedHeadingStore((s) => s.focusedHeadingId)
  const isFocused = focusedHeadingId === item.id

  const presentUsers = usePresentUsers(item.id)
  const [, setActiveHeading] = useActiveHeading()
  const unreadCount = useUnreadCount(item.id)
  const { openChatroom } = useTocActions()

  const isActive = headingId === item.id
  const hasChildren = nestedNodes.length > 0
  const hasPresentUsers = presentUsers.length > 0
  const trailingRailPx = tocTrailingRailPx(presentUsers.length, unreadCount)

  const isDragging = sortable.isDragging
  const isDescendantOfDragged = activeId ? collapsedIds.has(item.id) : false
  const isGhosted = isDragging || isDescendantOfDragged

  const [isHoveringHandle, setIsHoveringHandle] = useState(false)

  const setFocusedHeadingWithLock = useFocusedHeadingStore((s) => s.setFocusedHeadingWithLock)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!editor) return

      setActiveHeading(item.id)
      setFocusedHeadingWithLock(item.id)
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

  const liClassName = twMerge(
    'toc__item relative w-full',
    !item.open && 'closed',
    isFocused && TOC_CLASSES.itemFocused,
    isGhosted && 'is-ghosted',
    isDragging && 'is-dragging',
    hasChildren && 'has-children',
    hasPresentUsers && 'has-present-users'
  )

  const rowClassName = twMerge(
    TOC_CLASSES.row,
    'group relative flex items-center gap-1 overflow-hidden rounded whitespace-pre-line hyphens-auto',
    isActive && `active ${TOC_CLASSES.activeBorder} bg-base-300`
  )

  return (
    <li ref={sortable.setNodeRef} className={liClassName} data-id={item.id}>
      <div className={rowClassName} data-id={item.id}>
        <span className={TOC_CLASSES.levelBadge}>H{item.level}</span>

        <span className="relative flex shrink-0 items-center self-stretch">
          <Tooltip title="Drag to reorder" placement="top">
            <button
              type="button"
              className="toc-drag-handle"
              aria-label="Drag to reorder"
              {...sortable.attributes}
              {...sortable.listeners}
              onMouseEnter={() => setIsHoveringHandle(true)}
              onMouseLeave={() => setIsHoveringHandle(false)}
              onClick={(e) => e.preventDefault()}>
              <Icons.gripVertical size={16} aria-hidden className="stroke-[1.75]" />
            </button>
          </Tooltip>

          {isHoveringHandle && !isDragging && <TocLevelPicker level={item.level} mode="preview" />}
        </span>

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
            startIcon={<Icons.chevronRight size={18} className="fill-none stroke-current" />}
            tooltip="Toggle"
            tooltipPlacement="top"
          />
        )}

        <a
          className={twMerge(
            TOC_CLASSES.rowLink,
            'min-w-0 flex-1 hyphens-auto whitespace-pre-line text-inherit no-underline'
          )}
          onClick={handleClick}
          href={`?${item.id}`}
          data-id={item.id}>
          <span className="toc__link">{item.textContent}</span>
        </a>

        <div className="relative ml-auto h-8 shrink-0" style={{ width: trailingRailPx }}>
          <Tooltip title="Chat Room" placement="left">
            <button
              type="button"
              className={`${TOC_CLASSES.chatTrigger} absolute top-1/2 left-0 z-[3] flex -translate-y-1/2 items-center justify-center`}
              data-heading-id={item.id}
              onClick={handleChatClick}
              aria-label={chatTriggerAriaLabel(unreadCount)}>
              <ChatTriggerContent
                unreadCount={unreadCount}
                iconSize={20}
                iconClassName={twMerge(
                  TOC_CLASSES.chatIcon,
                  'cursor-pointer fill-none transition-colors',
                  isActive && TOC_CLASSES.chatIconActive,
                  !isActive && 'text-base-content/40 group-hover:text-primary hover:text-primary'
                )}
              />
            </button>
          </Tooltip>
          {hasPresentUsers && (
            <div className="absolute top-1/2 right-0 z-[2] -translate-y-1/2">
              <AvatarStack
                maxDisplay={4}
                size="sm"
                users={presentUsers}
                showStatus={true}
                tooltipPosition="left"
              />
            </div>
          )}
        </div>
      </div>

      {hasChildren && (
        <ul className={TOC_CLASSES.children}>
          {nestedNodes.map(({ item: childItem, nodes: grandNodes }) => (
            <TocItemDesktop
              key={childItem.id}
              item={childItem}
              nestedNodes={grandNodes}
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
