import { useChatroomContext } from '@components/chatroom/ChatroomContext'
import { computeVisualMediaLayout } from '@components/chatroom/utils/chatMediaVisualLayout'
import {
  clampFeedColumnWidth,
  resolveFeedColumnElement,
  resolveFeedLayoutOptions
} from '@components/chatroom/utils/feedAlbumLayout'
import { mediaKey } from '@components/chatroom/utils/galleryPlaylist'
import {
  type MediaPixelSize,
  positiveMediaDims
} from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem } from '@types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function mosaicTileContent(
  media: MessageMediaItem,
  index: number,
  onOpen: () => void,
  onDimensions: (w: number, h: number) => void
) {
  const key = `${mediaKey(media)}-${index}`
  if (media.type === 'video') {
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
    <MessageMediaImageLink key={key} media={media} onOpen={onOpen} onDimensions={onDimensions} />
  )
}

function singleTileContent(
  media: MessageMediaItem,
  cell: MediaPixelSize,
  onOpen: () => void,
  onDimensions: (w: number, h: number) => void
) {
  const key = mediaKey(media)
  if (media.type === 'video') {
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
  return (
    <div
      key={key}
      className="rounded-field relative overflow-hidden"
      style={{ width: cell.width, height: cell.height, maxWidth: '100%' }}>
      <MessageMediaImageLink media={media} onOpen={onOpen} onDimensions={onDimensions} />
    </div>
  )
}

export function MessageMediaVisualBlock({ visuals, onOpen }: Props) {
  const { variant } = useChatroomContext()
  const { widthCap, maxHeight, widthClass } = useMemo(
    () => resolveFeedLayoutOptions(variant === 'mobile' ? 'mobile' : 'desktop', visuals.length),
    [variant, visuals.length]
  )

  const hostRef = useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = useState(widthCap)

  useEffect(() => {
    setAvailableWidth(widthCap)
  }, [widthCap])

  // FeedColumnWidth measure adapter — never self-measure under shrink-to-fit.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const column = resolveFeedColumnElement(host)
    if (!column) return

    const sync = () => {
      const next = clampFeedColumnWidth(column.clientWidth, widthCap)
      setAvailableWidth((prev) => (prev === next ? prev : next))
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(column)
    return () => observer.disconnect()
  }, [widthCap])

  const visualsKey = visuals.map((media) => mediaKey(media)).join('\0')

  const [measured, setMeasured] = useState(() => seedMeasured(visuals))
  const pendingDimsRef = useRef<MeasuredMap>({})
  const flushRafRef = useRef<number | null>(null)

  useEffect(() => {
    if (flushRafRef.current != null) {
      cancelAnimationFrame(flushRafRef.current)
      flushRafRef.current = null
    }
    pendingDimsRef.current = {}
    setMeasured(seedMeasured(visuals))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: array identity must not reset
  }, [visualsKey])

  useEffect(() => {
    return () => {
      if (flushRafRef.current != null) cancelAnimationFrame(flushRafRef.current)
    }
  }, [])

  const dims = useMemo(
    () => visuals.map((media) => measured[mediaKey(media)] ?? null),
    [measured, visuals]
  )

  const layout = useMemo(
    () =>
      computeVisualMediaLayout(dims, {
        maxWidth: availableWidth,
        maxHeight
      }),
    [availableWidth, dims, maxHeight]
  )

  // Coalesce intrinsic-size reports into one setState per frame (Virtuoso-friendly).
  const setDim = useCallback((key: string, width: number, height: number) => {
    const next = positiveMediaDims(width, height)
    if (!next) return
    pendingDimsRef.current[key] = next
    if (flushRafRef.current != null) return
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = null
      const batch = pendingDimsRef.current
      pendingDimsRef.current = {}
      setMeasured((prev) => {
        let changed = false
        const merged = { ...prev }
        for (const [k, dim] of Object.entries(batch)) {
          if (merged[k]) continue
          merged[k] = dim
          changed = true
        }
        return changed ? merged : prev
      })
    })
  }, [])

  if (visuals.length === 0) return null

  const visible = visuals.slice(0, layout.cells.length)

  if (layout.mode === 'mosaic') {
    return (
      <div
        ref={hostRef}
        className={twMerge(
          // Host clips corners; tiles stay square (no per-cell radii).
          'bg-base-300/40 rounded-field relative min-w-0 overflow-hidden',
          widthClass
        )}
        data-media-layout="mosaic"
        style={{
          width: layout.containerWidth,
          height: layout.containerHeight,
          maxWidth: '100%'
        }}>
        {visible.map((media, index) => {
          const cell = layout.cells[index]
          if (!cell) return null
          const key = mediaKey(media)
          return (
            <div
              key={`${key}-${index}`}
              className="absolute overflow-hidden"
              style={{ left: cell.x, top: cell.y, width: cell.width, height: cell.height }}>
              {mosaicTileContent(
                media,
                index,
                () => onOpen(media),
                (w, h) => setDim(key, w, h)
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const media = visible[0]!
  const cell = layout.cells[0]!
  const key = mediaKey(media)
  return (
    <div
      ref={hostRef}
      className={twMerge('relative min-w-0', widthClass)}
      data-media-layout="single"
      style={{ width: '100%', maxWidth: cell.width }}>
      {singleTileContent(
        media,
        cell,
        () => onOpen(media),
        (w, h) => setDim(key, w, h)
      )}
    </div>
  )
}
