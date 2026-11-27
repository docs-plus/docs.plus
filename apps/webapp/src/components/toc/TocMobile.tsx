import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import React from 'react'

import { useToc, useTocAutoScroll } from './hooks'
import { TOC_CLASSES } from './tocClasses'
import { TocEmptyState } from './TocEmptyState'
import { TocItemBody } from './TocItemBody'

interface TocMobileProps {
  className?: string
}

function TocMobileComponent({ className = '' }: TocMobileProps) {
  const { items, nested: nestedItems, toggleSection } = useToc()
  useTocAutoScroll()

  return (
    <div className={className}>
      {!items.length ? (
        <TocEmptyState />
      ) : (
        <>
          <ul className={`${TOC_CLASSES.listMenu} my-2`}>
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
        </>
      )}
    </div>
  )
}

export const TocMobile = React.memo(TocMobileComponent)
