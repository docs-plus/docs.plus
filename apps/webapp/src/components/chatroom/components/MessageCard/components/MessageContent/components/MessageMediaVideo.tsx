import { FeedSpoilerRevealOverlay } from '@components/chatroom/components/MediaSpoilerReveal'
import {
  CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX,
  CHAT_MEDIA_MAX_WIDTH_CLASS
} from '@components/chatroom/utils/feedAlbumLayout'
import { useSpoilerGatedActivate } from '@components/chatroom/utils/feedSpoilerReveal'
import { messageMediaTheme } from '@components/chatroom/utils/messageMediaTheme'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { type CSSProperties } from 'react'
import { twMerge } from 'tailwind-merge'

import { MediaUnavailable } from './MediaUnavailable'
import { useFeedVideoMedia } from './useFeedVideoMedia'

type Props = {
  media: MessageMediaItem
  onOpen?: () => void
  width?: number
  height?: number
  className?: string
  onDimensions?: (width: number, height: number) => void
}

/** Lone feed video: native controls + optional Expand to lightbox. */
export function MessageMediaVideo({
  media,
  onOpen,
  width,
  height,
  className,
  onDimensions
}: Props) {
  const theme = messageMediaTheme('video')
  const { resolvedUrl, visibilityRef, signFailed, retry, handleMetadata } = useFeedVideoMedia(
    media,
    onDimensions
  )
  const { isSpoiler, onActivate: openIfReady } = useSpoilerGatedActivate(media, onOpen, {
    ready: Boolean(resolvedUrl),
    preventDefault: true
  })
  const hasExplicitSize = width != null && height != null
  const sizeStyle: CSSProperties | undefined = hasExplicitSize ? { width, height } : undefined

  return (
    <div
      ref={visibilityRef}
      className={twMerge(
        'group/video rounded-box relative overflow-hidden border bg-black',
        !hasExplicitSize && CHAT_MEDIA_MAX_WIDTH_CLASS,
        theme.cardBorder,
        className
      )}
      style={sizeStyle}>
      {resolvedUrl && !signFailed ? (
        <>
          <video
            src={resolvedUrl}
            controls={!isSpoiler}
            playsInline
            className={twMerge('w-full', isSpoiler && 'scale-110 blur-xl')}
            style={
              hasExplicitSize
                ? { height, width: '100%', objectFit: 'contain' }
                : { maxHeight: CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX }
            }
            onLoadedMetadata={handleMetadata}
          />
          {isSpoiler ? (
            <button
              type="button"
              className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Reveal spoiler video"
              data-testid="feed-spoiler-reveal"
              onClick={openIfReady}>
              <FeedSpoilerRevealOverlay className="bg-black/40" />
            </button>
          ) : onOpen ? (
            <button
              type="button"
              onClick={openIfReady}
              className="btn btn-circle btn-xs bg-base-content/60 text-base-100 focus-visible:ring-primary absolute top-2 right-2 border-0 opacity-100 transition-opacity focus-visible:ring-2 sm:opacity-0 sm:group-hover/video:opacity-100 sm:focus-visible:opacity-100"
              aria-label="Expand video">
              <Icons.maximize2 size={14} />
            </button>
          ) : null}
        </>
      ) : signFailed ? (
        <MediaUnavailable
          kind="video"
          label="Video unavailable"
          className="text-base-100 p-4"
          onRetry={retry}
        />
      ) : (
        <div
          className="skeleton w-full"
          style={hasExplicitSize ? { height } : { minHeight: 120 }}
          aria-hidden
        />
      )}
    </div>
  )
}
