import { useModal } from '@components/ui/ModalDrawer'
import { useUnreadCount } from '@hooks/useUnreadCount'
import { Icons } from '@icons'
import { useChatStore, useFocusedHeadingStore } from '@stores'
import type { TocItem as TocItemType } from '@types'
import { memo, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { tocActions } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocRow } from './TocRow'
import { TocRowTrail } from './TocRowTrail'
import type { NestedTocNode } from './utils'

interface TocItemMobileProps {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
}

function TocItemMobileComponent({ item, nestedNodes, onToggle }: TocItemMobileProps) {
  const isFocused = useFocusedHeadingStore((s) => s.focusedHeadingId === item.id)
  const isActive = useChatStore((state) => state.chatRoom.headingId === item.id)

  const unreadCount = useUnreadCount(item.id)
  const modal = useModal()

  const hasChildren = nestedNodes.length > 0

  const setFocusedHeadingWithLock = useFocusedHeadingStore((s) => s.setFocusedHeadingWithLock)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setFocusedHeadingWithLock(item.id)
      tocActions.navigateToHeading(item.id, { openChat: false })
      modal?.close?.()
    },
    [item.id, setFocusedHeadingWithLock, modal]
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
      tocActions.openChatroom(item.id, { focusEditor: false })
      modal?.close?.()
    },
    [item.id, modal]
  )

  const liClassName = twMerge('toc__item relative w-full', !item.open && 'closed')

  return (
    <li className={liClassName} data-id={item.id}>
      <TocRow
        headingId={item.id}
        title={item.textContent}
        density="mobile"
        isActive={isActive}
        isFocused={isFocused}
        onTitleClick={handleClick}
        titleHref={`?${item.id}`}
        leading={
          hasChildren ? (
            <button
              type="button"
              className={twMerge(
                TOC_CLASSES.foldBtn,
                'inline-flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center',
                item.open ? 'opened' : 'closed'
              )}
              onClick={handleToggle}
              aria-label={item.open ? 'Collapse section' : 'Expand section'}>
              <Icons.chevronRight size={18} className="fill-none stroke-current" aria-hidden />
            </button>
          ) : null
        }
        trail={
          <TocRowTrail
            headingId={item.id}
            unreadCount={unreadCount}
            isActive={isActive}
            iconSize={20}
            iconClassName={twMerge(TOC_CLASSES.chatIcon, 'text-base-content/60')}
            onChatClick={handleChatClick}
          />
        }
      />

      {hasChildren && (
        <ul className={TOC_CLASSES.children}>
          {nestedNodes.map(({ item: childItem, nodes: grandNodes }) => (
            <TocItemMobile
              key={childItem.id}
              item={childItem}
              nestedNodes={grandNodes}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export const TocItemMobile = memo(TocItemMobileComponent)
