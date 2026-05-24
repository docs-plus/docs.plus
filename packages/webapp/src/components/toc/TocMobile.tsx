import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import React from 'react'

import { useToc, useTocAutoScroll } from './hooks'
import { TocItemMobile } from './TocItemMobile'
import { buildNestedToc } from './utils'

interface TocMobileProps {
  className?: string
}

export function TocMobile({ className = '' }: TocMobileProps) {
  const { items, toggleSection } = useToc()

  // Auto-scroll TOC to the focused heading when the drawer opens (mirrors TocDesktop)
  useTocAutoScroll()

  if (!items.length) {
    return null
  }

  const nestedItems = buildNestedToc(items)

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

export default React.memo(TocMobile)
