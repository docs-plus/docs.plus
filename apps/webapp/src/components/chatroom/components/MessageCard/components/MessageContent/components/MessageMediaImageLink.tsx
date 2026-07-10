import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import {
  markFeedSpoilerRevealed,
  useFeedSpoilerRevealed
} from '@components/chatroom/utils/feedSpoilerReveal'
import { positiveMediaDims } from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem } from '@types'
import { type CSSProperties, type MouseEvent, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { MediaUnavailable } from './MediaUnavailable'

type Props = {
  media: MessageMediaItem
  className?: string
  onOpen?: () => void
  onDimensions?: (width: number, height: number) => void
}

/** Fill-only image tile for ratio-first visual cells (parent owns the box). */
export function MessageMediaImageLink({ media, className, onOpen, onDimensions }: Props) {
  const { url: resolvedUrl, ref: visibilityRef, signFailed, retry } = useFeedMediaDisplayUrl(media)
  const [imgFailed, setImgFailed] = useState(false)
  const revealed = useFeedSpoilerRevealed(media)
  const isSpoiler = Boolean(media.spoiler) && !revealed
  const hasSpoiler = Boolean(media.spoiler)
  const alt = media.name?.trim() || 'Image attachment'
  const showUnavailable = signFailed || imgFailed
  const handleRetry = () => {
    setImgFailed(false)
    retry()
  }
  const coverStyle =
    resolvedUrl && !showUnavailable
      ? ({ backgroundImage: `url(${JSON.stringify(resolvedUrl)})` } satisfies CSSProperties)
      : undefined

  const handleActivate = (event: MouseEvent) => {
    event.stopPropagation()
    if (isSpoiler) {
      markFeedSpoilerRevealed(media)
      return
    }
    onOpen?.()
  }

  const imageLayerClass = twMerge(
    'bg-cover bg-center bg-no-repeat',
    isSpoiler && resolvedUrl && 'scale-110 blur-xl',
    !resolvedUrl && 'bg-base-200 skeleton'
  )

  const spoilerOverlay = isSpoiler ? (
    <span className="bg-base-content/35 text-base-100 absolute inset-0 flex items-center justify-center text-xs font-medium">
      Tap to reveal
    </span>
  ) : null

  const testId = isSpoiler ? 'feed-spoiler-reveal' : 'feed-image-open'

  if (!hasSpoiler && !resolvedUrl && !showUnavailable) {
    return (
      <div
        ref={visibilityRef}
        className={twMerge('bg-base-200 skeleton absolute inset-0', className)}
        aria-hidden
      />
    )
  }

  if (!hasSpoiler && showUnavailable) {
    return (
      <MediaUnavailable
        label="Image unavailable"
        className={twMerge('absolute inset-0', className)}
        onRetry={handleRetry}
      />
    )
  }

  return (
    <button
      type="button"
      ref={visibilityRef}
      className={twMerge(
        'bg-base-200 absolute inset-0 block overflow-hidden border-0 p-0',
        'focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none',
        isSpoiler ? 'cursor-pointer' : 'cursor-zoom-in',
        className
      )}
      aria-label={isSpoiler ? 'Reveal spoiler image' : `View ${alt}`}
      data-testid={testId}
      onClick={handleActivate}>
      <span
        aria-hidden
        className={twMerge('absolute inset-0', imageLayerClass)}
        style={coverStyle}
      />
      {spoilerOverlay}
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={alt}
          className="sr-only"
          loading="lazy"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            const dims = positiveMediaDims(naturalWidth, naturalHeight)
            if (dims) onDimensions?.(dims.width, dims.height)
          }}
          onError={() => setImgFailed(true)}
        />
      ) : null}
    </button>
  )
}
