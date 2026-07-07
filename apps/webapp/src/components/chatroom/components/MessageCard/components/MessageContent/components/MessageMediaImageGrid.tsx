import { getChatMediaCollageLayout } from '@components/chatroom/utils/chatMediaCollageLayout'
import { CHAT_MEDIA_MAX_WIDTH_CLASS } from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem } from '@types'
import { type CSSProperties } from 'react'
import { twMerge } from 'tailwind-merge'

import { MessageMediaImageLink } from './MessageMediaImageLink'

const GRID_CAP = 4

type Props = {
  images: MessageMediaItem[]
  onExpand: (index: number) => void
}

export function MessageMediaImageGrid({ images, onExpand }: Props) {
  const visible = images.slice(0, GRID_CAP)
  const overflow = images.length - GRID_CAP
  const layout = getChatMediaCollageLayout(visible.length)

  if (visible.length === 1) {
    return (
      <MessageMediaImageLink
        media={visible[0]!}
        className={CHAT_MEDIA_MAX_WIDTH_CLASS}
        onOpen={() => onExpand(0)}
      />
    )
  }

  const gridStyle: CSSProperties = {
    gridTemplateAreas: layout.templateAreas,
    gridTemplateColumns: layout.templateColumns,
    gridTemplateRows: layout.templateRows,
    ...(layout.heightPx != null ? { height: `${layout.heightPx}px` } : {})
  }

  return (
    <div
      className={twMerge(
        'bg-base-300/40 rounded-field relative grid w-full gap-px overflow-hidden',
        CHAT_MEDIA_MAX_WIDTH_CLASS
      )}
      style={gridStyle}>
      {visible.map((image, index) => {
        const placement = layout.placements[index]
        if (!placement) return null

        return (
          <div
            key={`${image.path ?? image.url}-${index}`}
            className="relative min-h-0 min-w-0"
            style={{ gridArea: placement.area }}>
            <MessageMediaImageLink fill media={image} onOpen={() => onExpand(index)} />
          </div>
        )
      })}
      {overflow > 0 ? (
        <button
          type="button"
          className="bg-base-content/60 text-base-100 absolute right-1 bottom-1 z-10 rounded px-1.5 py-0.5 text-xs font-semibold"
          aria-label={`Show ${overflow} more ${overflow === 1 ? 'image' : 'images'}`}
          onClick={(e) => {
            e.stopPropagation()
            onExpand(GRID_CAP)
          }}>
          +{overflow}
        </button>
      ) : null}
    </div>
  )
}
