import { useSortable } from '@dnd-kit/sortable'
import type { TocItem as TocItemType } from '@types'
import { memo } from 'react'

import { TocItemBody } from './TocItemBody'
import type { NestedTocNode } from './utils'

const EMPTY_COLLAPSED = new Set<string>()

interface TocItemDesktopProps {
  item: TocItemType
  nestedNodes: NestedTocNode<TocItemType>[]
  onToggle: (id: string) => void
  activeId?: string | null
  collapsedIds?: Set<string>
  locked: boolean
}

/** Desktop sortable shell — only adapter that may call `useSortable`. */
function TocItemDesktopComponent({
  item,
  nestedNodes,
  onToggle,
  activeId = null,
  collapsedIds = EMPTY_COLLAPSED,
  locked
}: TocItemDesktopProps) {
  // R3: the Title never moves; a locked pad starts no drag.
  const canDrag = !item.isTitle && !locked
  const sortable = useSortable({
    id: item.id,
    disabled: !canDrag || collapsedIds.has(item.id)
  })

  return (
    <TocItemBody
      item={item}
      nestedNodes={nestedNodes}
      onToggle={onToggle}
      variant="desktop"
      sortable={sortable}
      canDrag={canDrag}
      activeId={activeId}
      collapsedIds={collapsedIds}
      renderChild={({ item: childItem, nodes: grandNodes }) => (
        <TocItemDesktop
          key={childItem.id}
          item={childItem}
          nestedNodes={grandNodes}
          onToggle={onToggle}
          activeId={activeId}
          collapsedIds={collapsedIds}
          locked={locked}
        />
      )}
    />
  )
}

export const TocItemDesktop = memo(TocItemDesktopComponent)
