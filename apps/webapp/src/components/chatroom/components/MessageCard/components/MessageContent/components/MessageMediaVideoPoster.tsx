import { FeedSpoilerRevealOverlay } from '@components/chatroom/components/MediaSpoilerReveal'
import { useSpoilerGatedActivate } from '@components/chatroom/utils/feedSpoilerReveal'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { twMerge } from '@utils/twMerge'

import { MediaUnavailable } from './MediaUnavailable'
import { useFeedVideoMedia } from './useFeedVideoMedia'

type Props = {
  media: MessageMediaItem
  onOpen: () => void
  className?: string
  onDimensions?: (width: number, height: number) => void
}

/** Mosaic/stack video tile: play badge → lightbox (no inline controls). */
export function MessageMediaVideoPoster({ media, onOpen, className, onDimensions }: Props) {
  const { resolvedUrl, visibilityRef, signFailed, retry, handleMetadata } = useFeedVideoMedia(
    media,
    onDimensions
  )
  const { isSpoiler, onActivate: openIfReady } = useSpoilerGatedActivate(media, onOpen, {
    ready: Boolean(resolvedUrl),
    preventDefault: true
  })

  // A failed tile has nothing to play, and a button root would nest the Retry button.
  if (signFailed) {
    return (
      <div ref={visibilityRef} className={twMerge('relative block overflow-hidden', className)}>
        <MediaUnavailable
          kind="video"
          label="Video unavailable"
          className="absolute inset-0"
          onRetry={retry}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      ref={visibilityRef}
      className={twMerge(
        'group/video relative block overflow-hidden border-0 bg-black p-0',
        'focus-visible:ring-primary cursor-pointer focus-visible:ring-2 focus-visible:outline-none',
        className
      )}
      aria-label={isSpoiler ? 'Reveal spoiler video' : `Play ${media.name?.trim() || 'video'}`}
      data-testid={isSpoiler ? 'feed-spoiler-reveal' : 'feed-video-poster'}
      onClick={openIfReady}>
      {resolvedUrl ? (
        <>
          <video
            src={resolvedUrl}
            playsInline
            muted
            preload="metadata"
            className={twMerge(
              'absolute inset-0 h-full w-full object-cover',
              isSpoiler && 'scale-110 blur-xl'
            )}
            onLoadedMetadata={handleMetadata}
          />
          {isSpoiler ? (
            <FeedSpoilerRevealOverlay />
          ) : (
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="flex size-10 items-center justify-center rounded-full border border-white/70 bg-black/60 text-white">
                <Icons.play size={18} className="ml-0.5" />
              </span>
            </span>
          )}
        </>
      ) : (
        <div className="skeleton absolute inset-0 rounded-none" aria-hidden />
      )}
    </button>
  )
}
