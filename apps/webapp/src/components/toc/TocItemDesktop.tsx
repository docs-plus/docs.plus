import { useDraggable } from '@dnd-kit/core'
import type { TocItem as TocItemType } from '@types'
import { memo, useCallback } from 'react'

import { TocItemBody } from './TocItemBody'
import type { NestedTocNode } from './utils/buildNestedToc'

interface TocItemDesktopProps {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
  activeId: string | null
  collapsedIds: Set<string>
  locked: boolean
}

/** Desktop drag shell — the only adapter that may call `useDraggable`. */
function TocItemDesktopComponent({
  item,
  nestedNodes,
  onToggle,
  activeId,
  collapsedIds,
  locked
}: TocItemDesktopProps) {
  // R3: the Title never moves; a locked pad starts no drag.
  const canDrag = !item.isTitle && !locked
  const draggable = useDraggable({
    id: item.id,
    disabled: !canDrag || collapsedIds.has(item.id)
  })

  // Stable, so a memoized child row skips a render when only another heading changed.
  const renderChild = useCallback(
    ({ item: childItem, nodes: grandNodes }: NestedTocNode<TocItemType>) => (
      <TocItemDesktop
        key={childItem.id}
        item={childItem}
        nestedNodes={grandNodes}
        onToggle={onToggle}
        activeId={activeId}
        collapsedIds={collapsedIds}
        locked={locked}
      />
    ),
    [onToggle, activeId, collapsedIds, locked]
  )

  return (
    <TocItemBody
      item={item}
      nestedNodes={nestedNodes}
      onToggle={onToggle}
      variant="desktop"
      draggable={draggable}
      canDrag={canDrag}
      activeId={activeId}
      collapsedIds={collapsedIds}
      renderChild={renderChild}
    />
  )
}

export const TocItemDesktop = memo(TocItemDesktopComponent)
