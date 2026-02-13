import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import React from 'react'

import { useToc, useTocAutoScroll } from './hooks'
import { TocHeader } from './TocHeader'
import { TocItemMobile } from './TocItemMobile'
import { buildNestedToc } from './utils'

interface TocMobileProps {
  className?: string
  /** Hide the append-heading button (e.g. when the consumer renders it in a sticky footer) */
  hideAppendButton?: boolean
}

export function TocMobile({ className = '', hideAppendButton = false }: TocMobileProps) {
  const { items, toggleSection } = useToc()

  // Auto-scroll TOC to the focused heading when the drawer opens (mirrors TocDesktop)
  useTocAutoScroll()

  if (!items.length) {
    return null
  }

  const nestedItems = buildNestedToc(items)

  return (
    <div className={className}>
      <TocHeader variant="mobile" />
      <ul className="toc__list menu my-2 p-0">
        {nestedItems.map(({ item, children }) => (
          <TocItemMobile key={item.id} item={item} childItems={children} onToggle={toggleSection} />
        ))}
      </ul>
      {!hideAppendButton && <AppendHeadingButton className="mt-4" />}
    </div>
  )
}

export default React.memo(TocMobile)
