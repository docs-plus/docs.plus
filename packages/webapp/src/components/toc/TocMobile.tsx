import React from 'react'
import { useToc } from './hooks'
import { buildNestedToc } from './utils'
import { TocHeader } from './TocHeader'
import { TocItemMobile } from './TocItemMobile'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'

interface TocMobileProps {
  className?: string
}

export function TocMobile({ className = '' }: TocMobileProps) {
  const { items, toggleSection } = useToc()

  if (!items.length) {
    return null
  }

  const nestedItems = buildNestedToc(items)

  return (
    <div className={className}>
      <TocHeader variant="mobile" />
      <ul className="toc__list menu p-0">
        {nestedItems.map(({ item, children }) => (
          <TocItemMobile key={item.id} item={item} childItems={children} onToggle={toggleSection} />
        ))}
      </ul>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export default React.memo(TocMobile)
