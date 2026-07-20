import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import React, { useMemo } from 'react'

import { useToc, useTocAutoScroll } from './hooks'
import { TocEmptyState } from './TocEmptyState'
import { TocItemMobile } from './TocItemMobile'
import { buildNestedToc } from './utils'

interface TocMobileProps {
  className?: string
}

function TocMobileComponent({ className = '' }: TocMobileProps) {
  const { items, toggleSection } = useToc()

  // Auto-scroll TOC to the focused heading when the drawer opens (mirrors TocDesktop)
  useTocAutoScroll()

  const nestedItems = useMemo(() => buildNestedToc(items), [items])

  if (!items.length) {
    return <TocEmptyState className={className} />
  }

  return (
    <div className={className}>
      <ul className="toc__list menu my-2 p-0">
        {nestedItems.map(({ item, nodes }) => (
          <TocItemMobile key={item.id} item={item} nestedNodes={nodes} onToggle={toggleSection} />
        ))}
      </ul>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export const TocMobile = React.memo(TocMobileComponent)
