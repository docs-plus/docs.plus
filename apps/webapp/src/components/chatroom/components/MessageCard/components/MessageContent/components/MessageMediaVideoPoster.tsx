import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { type CSSProperties, type MouseEvent, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

import { MediaUnavailable } from './MediaUnavailable'
import { useFeedVideoMedia } from './useFeedVideoMedia'

type Props = {
  media: MessageMediaItem
  onOpen: () => void
  width?: number
  height?: number
  className?: string
  onDimensions?: (width: number, height: number) => void
}

/** Mosaic/stack video tile: play badge → lightbox (no inline controls). */
export function MessageMediaVideoPoster({
  media,
  onOpen,
  width,
  height,
  className,
  onDimensions
}: Props) {
  const { resolvedUrl, visibilityRef, signFailed, retry, handleMetadata } = useFeedVideoMedia(
    media,
    onDimensions
  )
  const hasExplicitSize = width != null && height != null
  const sizeStyle: CSSProperties | undefined = hasExplicitSize ? { width, height } : undefined

  const openIfReady = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (resolvedUrl) onOpen()
    },
    [onOpen, resolvedUrl]
  )

  return (
    <button
      type="button"
      ref={visibilityRef}
      className={twMerge(
        'group/video relative block overflow-hidden border-0 bg-black p-0',
        'focus-visible:ring-primary cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
        !hasExplicitSize && 'h-full w-full',
        className
      )}
      style={sizeStyle}
      aria-label={`Play ${media.name?.trim() || 'video'}`}
      data-testid="feed-video-poster"
      onClick={openIfReady}>
      {resolvedUrl && !signFailed ? (
        <>
          <video
            src={resolvedUrl}
            playsInline
            muted
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
            onLoadedMetadata={handleMetadata}
          />
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="bg-base-content/60 text-base-100 flex size-10 items-center justify-center rounded-full border border-white/70">
              <Icons.play size={18} className="ml-0.5" />
            </span>
          </span>
        </>
      ) : signFailed ? (
        <MediaUnavailable
          kind="video"
          label="Video unavailable"
          className="text-base-100 absolute inset-0"
          onRetry={retry}
        />
      ) : (
        <div className="skeleton absolute inset-0" aria-hidden />
      )}
    </button>
  )
}
