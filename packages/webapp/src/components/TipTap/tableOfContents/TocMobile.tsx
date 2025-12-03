import React, { memo, useCallback } from 'react'
import { useModal } from '@components/ui/ModalDrawer'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { DocTitle, TocList } from './components'
import { useTocItems } from './hooks'

interface TocMobileProps {
  className?: string
}

const TocMobile = memo(({ className = '' }: TocMobileProps) => {
  const items = useTocItems()
  const { close: closeModal } = useModal() || {}

  const handleNavigate = useCallback(() => {
    closeModal?.()
  }, [closeModal])

  if (!items.length) return null

  return (
    <div className={className}>
      <DocTitle variant="mobile" />

      <ul className="toc__list menu p-0">
        <TocList items={items} variant="mobile" onNavigate={handleNavigate} />
      </ul>

      <AppendHeadingButton className="mt-4" />
    </div>
  )
})

TocMobile.displayName = 'TocMobile'

export default TocMobile
