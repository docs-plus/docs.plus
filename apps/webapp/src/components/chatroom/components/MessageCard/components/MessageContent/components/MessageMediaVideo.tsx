import { FeedSpoilerRevealOverlay } from '@components/chatroom/components/MediaSpoilerReveal'
import { useSpoilerGatedActivate } from '@components/chatroom/utils/feedSpoilerReveal'
import { messageMediaTheme } from '@components/chatroom/utils/messageMediaTheme'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { twMerge } from '@utils/twMerge'

import { MediaUnavailable } from './MediaUnavailable'
import { useFeedVideoMedia } from './useFeedVideoMedia'

type Props = {
  media: MessageMediaItem
  onOpen: () => void
  width: number
  height: number
  onDimensions?: (width: number, height: number) => void
}

/** Lone feed video: native controls + Expand to lightbox. */
export function MessageMediaVideo({ media, onOpen, width, height, onDimensions }: Props) {
  const theme = messageMediaTheme('video')
  const { resolvedUrl, visibilityRef, signFailed, retry, handleMetadata } = useFeedVideoMedia(
    media,
    onDimensions
  )
  const { isSpoiler, onActivate: openIfReady } = useSpoilerGatedActivate(media, onOpen, {
    ready: Boolean(resolvedUrl),
    preventDefault: true
  })

  return (
    <div
      ref={visibilityRef}
      className={twMerge(
        'group/video rounded-field relative overflow-hidden border bg-black',
        theme.cardBorder
      )}
      style={{ width, height }}>
      {resolvedUrl && !signFailed ? (
        <>
          <video
            src={resolvedUrl}
            controls={!isSpoiler}
            playsInline
            className={twMerge('w-full', isSpoiler && 'scale-110 blur-xl')}
            style={{ height, width: '100%', objectFit: 'contain' }}
            onLoadedMetadata={handleMetadata}
          />
          {isSpoiler ? (
            <button
              type="button"
              className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Reveal spoiler video"
              data-testid="feed-spoiler-reveal"
              onClick={openIfReady}>
              <FeedSpoilerRevealOverlay />
            </button>
          ) : (
            <button
              type="button"
              onClick={openIfReady}
              className="btn btn-circle btn-xs focus-visible:ring-primary absolute top-2 right-2 border-0 bg-black/60 text-white opacity-100 transition-[opacity,background-color] hover:bg-black/75 focus-visible:ring-2 sm:opacity-0 sm:group-hover/video:opacity-100 sm:focus-visible:opacity-100"
              aria-label="Expand video">
              <Icons.maximize2 size={14} />
            </button>
          )}
        </>
      ) : signFailed ? (
        <MediaUnavailable kind="video" label="Video unavailable" className="p-4" onRetry={retry} />
      ) : (
        <div className="skeleton w-full" style={{ height }} aria-hidden />
      )}
    </div>
  )
}
