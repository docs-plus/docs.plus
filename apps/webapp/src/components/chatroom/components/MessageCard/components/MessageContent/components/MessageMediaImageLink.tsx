import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import {
  markFeedSpoilerRevealed,
  useFeedSpoilerRevealed
} from '@components/chatroom/utils/feedSpoilerReveal'
import type { MessageMediaItem } from '@types'
import { type CSSProperties, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { MediaUnavailable } from './MediaUnavailable'

type Props = {
  media: MessageMediaItem
  className?: string
  fill?: boolean
  onOpen?: () => void
}

export function MessageMediaImageLink({ media, className, fill = false, onOpen }: Props) {
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

  const handleActivate = (event: React.MouseEvent) => {
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
        className={twMerge(
          'bg-base-200 skeleton',
          fill ? 'absolute inset-0' : 'min-h-[80px] rounded-lg',
          className
        )}
        aria-hidden
      />
    )
  }

  if (!hasSpoiler && showUnavailable) {
    return (
      <MediaUnavailable
        label="Image unavailable"
        className={twMerge(fill ? 'absolute inset-0' : 'min-h-[80px] rounded-lg', className)}
        onRetry={handleRetry}
      />
    )
  }

  if (fill) {
    return (
      <button
        type="button"
        ref={visibilityRef}
        className={twMerge(
          'bg-base-200 absolute inset-0 block overflow-hidden border-0 p-0',
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
            onError={() => setImgFailed(true)}
          />
        ) : null}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={twMerge(
        'bg-base-200 relative block w-full max-w-full overflow-hidden rounded-lg border-0 p-0',
        isSpoiler ? 'cursor-pointer' : 'cursor-zoom-in',
        className
      )}
      style={{ maxHeight: 360 }}
      aria-label={isSpoiler ? 'Reveal spoiler image' : `View ${alt}`}
      data-testid={testId}
      ref={visibilityRef}
      onClick={handleActivate}>
      <span
        aria-hidden
        className={twMerge('block w-full', imageLayerClass)}
        style={{
          ...coverStyle,
          aspectRatio: '4 / 3',
          maxHeight: 360
        }}
      />
      {spoilerOverlay}
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={alt}
          className="sr-only"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : null}
    </button>
  )
}
