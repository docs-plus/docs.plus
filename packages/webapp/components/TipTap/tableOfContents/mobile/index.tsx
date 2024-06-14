import React, { useEffect, useState } from 'react'
import { useChatStore } from '@stores'
import useHandelTocUpdate from '../hooks/useHandelTocUpdate'
import { RenderTocs } from './RenderTocs'

const TableOfContents = ({ className }: any) => {
  const { headingId } = useChatStore((state) => state.chatRoom)
  const { items } = useHandelTocUpdate()
  const [renderedTocs, setRenderedTocs] = useState([])

  useEffect(() => {
    if (!items.length) return
    const tocs = RenderTocs(items)
    // @ts-ignore
    setRenderedTocs(tocs)
  }, [items, headingId])

  if (!items.length) return null

  return (
    <div className={`${className}`}>
      <ul className="toc__list menu p-0">{renderedTocs}</ul>
    </div>
  )
}

export default React.memo(TableOfContents)
