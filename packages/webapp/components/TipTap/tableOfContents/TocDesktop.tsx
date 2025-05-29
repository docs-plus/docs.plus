import React, { useEffect, useState } from 'react'
import { useChatStore } from '@stores'
import useHandelTocUpdate from './hooks/useHandelTocUpdate'
import { RenderTocs } from './RenderTocs'
import { DocTitleChatRoomDesktop } from './components/DocTitleChatRoom'
import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'

const TOCDesktop = ({ className }: any) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const [renderedTocs, setRenderedTocs] = useState([])
  const { items } = useHandelTocUpdate()

  useEffect(() => {
    if (!items.length) return
    const tocs = RenderTocs(items)
    // @ts-ignore
    setRenderedTocs(tocs)
  }, [items, headingId])

  if (!items.length) return null

  return (
    <div className={`${className}`} style={{ scrollbarGutter: 'stable' }}>
      <DocTitleChatRoomDesktop className="my-1" />
      <ul className="toc__list menu p-0">{renderedTocs}</ul>
      <AppendHeadingButton className="mt-4" />
    </div>
  )
}

export default React.memo(TOCDesktop)
