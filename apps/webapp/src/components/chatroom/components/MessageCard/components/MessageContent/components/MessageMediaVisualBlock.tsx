import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import {
  CHAT_MEDIA_VISIBLE_CAP,
  computeVisualMediaLayout,
  type VisualMediaLayout,
  type VisualMediaMosaicCell,
  type VisualMediaSizedCell
} from '@components/chatroom/utils/chatMediaVisualLayout'
import { mediaKey } from '@components/chatroom/utils/galleryPlaylist'
import {
  CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX,
  CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_PX,
  CHAT_MEDIA_FEED_MAX_WIDTH_PX,
  CHAT_MEDIA_MAX_WIDTH_CLASS,
  CHAT_MEDIA_STACK_GAP_PX,
  type MediaPixelSize,
  positiveMediaDims
} from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem } from '@types'
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { MessageMediaImageLink } from './MessageMediaImageLink'
import { MessageMediaVideo } from './MessageMediaVideo'
import { MessageMediaVideoPoster } from './MessageMediaVideoPoster'

type Props = {
  visuals: MessageMediaItem[]
  onOpen: (media: MessageMediaItem) => void
}

type MeasuredMap = Record<string, MediaPixelSize>

function seedMeasured(visuals: MessageMediaItem[]): MeasuredMap {
  const initial: MeasuredMap = {}
  for (const media of visuals) {
    const dims = positiveMediaDims(media.width, media.height)
    if (dims) initial[mediaKey(media)] = dims
  }
  return initial
}

function OverflowBadge({
  count,
  media,
  onOpen
}: {
  count: number
  media: MessageMediaItem
  onOpen: (media: MessageMediaItem) => void
}) {
  return (
    <button
      type="button"
      className="bg-base-content/60 text-base-100 focus-visible:ring-primary rounded-selector absolute right-1 bottom-1 z-10 px-1.5 py-0.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
      aria-label={`Show ${count} more`}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(media)
      }}>
      +{count}
    </button>
  )
}

function renderImageCell(
  media: MessageMediaItem,
  cell: VisualMediaSizedCell | VisualMediaMosaicCell,
  index: number,
  fill: 'cover' | 'sized',
  onOpen: () => void,
  onDimensions: (w: number, h: number) => void
) {
  const key = `${mediaKey(media)}-${index}`

  if (fill === 'cover') {
    return (
      <MessageMediaImageLink key={key} media={media} onOpen={onOpen} onDimensions={onDimensions} />
    )
  }

  return (
    <div
      key={key}
      className="rounded-field relative overflow-hidden"
      style={{ width: cell.width, height: cell.height, maxWidth: '100%' }}>
      <MessageMediaImageLink media={media} onOpen={onOpen} onDimensions={onDimensions} />
    </div>
  )
}

function renderVideoCell(
  media: MessageMediaItem,
  cell: VisualMediaSizedCell | VisualMediaMosaicCell,
  index: number,
  mode: VisualMediaLayout['mode'],
  onOpen: () => void,
  onDimensions: (w: number, h: number) => void
) {
  const key = `${mediaKey(media)}-${index}`

  if (mode === 'single') {
    return (
      <MessageMediaVideo
        key={key}
        media={media}
        width={cell.width}
        height={cell.height}
        className="rounded-box"
        onOpen={onOpen}
        onDimensions={onDimensions}
      />
    )
  }

  if (mode === 'mosaic') {
    return (
      <MessageMediaVideoPoster
        key={key}
        media={media}
        className="absolute inset-0 h-full w-full rounded-none"
        onOpen={onOpen}
        onDimensions={onDimensions}
      />
    )
  }

  return (
    <MessageMediaVideoPoster
      key={key}
      media={media}
      width={cell.width}
      height={cell.height}
      className="rounded-field"
      onOpen={onOpen}
      onDimensions={onDimensions}
    />
  )
}

export function MessageMediaVisualBlock({ visuals, onOpen }: Props) {
  const { variant } = useChatroomContext()
  const maxHeight =
    variant === 'mobile'
      ? CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_PX
      : CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX

  const visualsKey = visuals.map((media) => mediaKey(media)).join('\0')

  const [measured, setMeasured] = useState(() => seedMeasured(visuals))

  useEffect(() => {
    setMeasured(seedMeasured(visuals))
    // visualsKey is the identity; visuals is read for seed values of those keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: array identity must not reset
  }, [visualsKey])

  const dims = useMemo(
    () => visuals.map((media) => measured[mediaKey(media)] ?? null),
    [measured, visuals]
  )

  const layout = useMemo(
    () =>
      computeVisualMediaLayout(dims, {
        maxWidth: CHAT_MEDIA_FEED_MAX_WIDTH_PX,
        maxHeight
      }),
    [dims, maxHeight]
  )

  // First write wins (upload seed or first onLoad) — never overwrite with a later measurement.
  const setDim = useCallback((key: string, width: number, height: number) => {
    const next = positiveMediaDims(width, height)
    if (!next) return
    setMeasured((prev) => (prev[key] ? prev : { ...prev, [key]: next }))
  }, [])

  if (visuals.length === 0) return null

  const visible = visuals.slice(0, layout.cells.length)
  const overflowMedia = layout.overflowCount > 0 ? visuals[CHAT_MEDIA_VISIBLE_CAP] : undefined

  const renderCell = (
    media: MessageMediaItem,
    cell: VisualMediaSizedCell | VisualMediaMosaicCell,
    index: number,
    fill: 'cover' | 'sized'
  ) => {
    const key = mediaKey(media)
    const onDimensions = (w: number, h: number) => setDim(key, w, h)
    const open = () => onOpen(media)

    if (media.type === 'video') {
      return renderVideoCell(media, cell, index, layout.mode, open, onDimensions)
    }

    return renderImageCell(media, cell, index, fill, open, onDimensions)
  }

  if (layout.mode === 'mosaic') {
    const gridStyle: CSSProperties = {
      gridTemplateAreas: layout.templateAreas,
      gridTemplateColumns: layout.templateColumns,
      gridTemplateRows: layout.templateRows,
      width: layout.containerWidth,
      height: layout.containerHeight,
      maxWidth: '100%',
      gap: layout.mosaicGapPx
    }

    return (
      <div
        className={twMerge(
          'bg-base-300/40 rounded-field relative grid w-full overflow-hidden',
          CHAT_MEDIA_MAX_WIDTH_CLASS
        )}
        data-media-layout="mosaic"
        style={gridStyle}>
        {visible.map((media, index) => {
          const cell = layout.cells[index]
          if (!cell) return null
          return (
            <div
              key={`${mediaKey(media)}-${index}`}
              className="relative min-h-0 min-w-0"
              style={{ gridArea: cell.area }}>
              {renderCell(media, cell, index, 'cover')}
            </div>
          )
        })}
        {overflowMedia ? (
          <OverflowBadge count={layout.overflowCount} media={overflowMedia} onOpen={onOpen} />
        ) : null}
      </div>
    )
  }

  if (layout.mode === 'stack') {
    return (
      <div
        className={twMerge('flex flex-col', CHAT_MEDIA_MAX_WIDTH_CLASS)}
        data-media-layout="stack"
        style={{ gap: CHAT_MEDIA_STACK_GAP_PX }}>
        {visible.map((media, index) => renderCell(media, layout.cells[index]!, index, 'sized'))}
      </div>
    )
  }

  const media = visible[0]!
  const cell = layout.cells[0]!
  return (
    <div
      className={twMerge('relative', CHAT_MEDIA_MAX_WIDTH_CLASS)}
      data-media-layout="single"
      style={{ width: cell.width, maxWidth: '100%' }}>
      {renderCell(media, cell, 0, 'sized')}
    </div>
  )
}
