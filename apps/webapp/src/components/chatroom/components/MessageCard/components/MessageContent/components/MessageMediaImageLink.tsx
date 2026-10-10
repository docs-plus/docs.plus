import { FeedSpoilerRevealOverlay } from '@components/chatroom/components/MediaSpoilerReveal'
import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { useSpoilerGatedActivate } from '@components/chatroom/utils/feedSpoilerReveal'
import { positiveMediaDims } from '@components/chatroom/utils/messageMediaPaths'
import type { MessageMediaItem } from '@types'
import { twMerge } from '@utils/twMerge'
import { type CSSProperties, useState } from 'react'

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
  // The cover paints from the cache once the hidden img has loaded that URL; until then the bone stays.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const { isSpoiler, onActivate } = useSpoilerGatedActivate(media, onOpen)
  const hasSpoiler = Boolean(media.spoiler)
  const alt = media.name?.trim() || 'Image attachment'
  const showUnavailable = signFailed || imgFailed
  const handleRetry = () => {
    setImgFailed(false)
    retry()
  }
  const coverStyle =
    loadedUrl && !showUnavailable
      ? ({ backgroundImage: `url(${JSON.stringify(loadedUrl)})` } satisfies CSSProperties)
      : undefined

  // The cover classes go on only with the image: bg-cover beats the skeleton's background-size
  // and freezes its shimmer.
  const imageLayerClass = twMerge(
    loadedUrl ? 'bg-cover bg-center bg-no-repeat' : !showUnavailable && 'skeleton rounded-none',
    isSpoiler && loadedUrl && 'scale-110 blur-xl'
  )

  const testId = isSpoiler ? 'feed-spoiler-reveal' : 'feed-image-open'

  if (!hasSpoiler && !resolvedUrl && !showUnavailable) {
    return (
      <div
        ref={visibilityRef}
        className={twMerge('skeleton absolute inset-0', className)}
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
      onClick={onActivate}>
      <span
        aria-hidden
        className={twMerge('absolute inset-0', imageLayerClass)}
        style={coverStyle}
      />
      {isSpoiler ? <FeedSpoilerRevealOverlay /> : null}
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={alt}
          className="sr-only"
          loading="lazy"
          onLoad={(event) => {
            setLoadedUrl(resolvedUrl)
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
