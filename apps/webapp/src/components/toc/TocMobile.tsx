import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import React, { useMemo } from 'react'

import { useToc, useTocAutoScroll } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocEmptyState } from './TocEmptyState'
import { TocItemBody } from './TocItemBody'
import { buildNestedToc } from './utils'

interface TocMobileProps {
  className?: string
}

function TocMobileComponent({ className = '' }: TocMobileProps) {
  const { items, toggleSection } = useToc()
  useTocAutoScroll()

  const nestedItems = useMemo(() => buildNestedToc(items), [items])

  if (!items.length) {
    return <TocEmptyState className={className} />
  }

  return (
    <div className={className}>
      <ul className={`${TOC_CLASSES.listMenu} my-2 p-0`}>
        {nestedItems.map(({ item, nodes }) => (
          <TocItemBody
            key={item.id}
            item={item}
            nestedNodes={nodes}
            onToggle={toggleSection}
            variant="mobile"
          />
        ))}
      </ul>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export const TocMobile = React.memo(TocMobileComponent)
