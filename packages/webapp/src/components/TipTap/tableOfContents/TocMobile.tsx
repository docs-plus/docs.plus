import React from 'react'
import useTocItems from './hooks/useTocItems'
import { TocList } from './components/TocItem'
import { DocTitleChatRoomMobile } from './components/DocTitleChatRoom'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { useModal } from '@components/ui/ModalDrawer'

type Props = {
  className?: string
}

const TocMobile = ({ className }: Props) => {
  const { items } = useTocItems()
  const { close: closeModal } = useModal() || {}

  if (!items.length) return null

  return (
    <div className={className}>
      <DocTitleChatRoomMobile />
      <ul className="toc__list menu p-0">
        <TocList items={items} variant="mobile" onNavigate={closeModal} />
      </ul>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export default React.memo(TocMobile)
