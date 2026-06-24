import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
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
  const [revealed, setRevealed] = useState(false)
  const isSpoiler = Boolean(media.spoiler) && !revealed
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
      setRevealed(true)
      return
    }
    onOpen?.()
  }

  const imageLayerClass = twMerge(
    'bg-cover bg-center bg-no-repeat',
    isSpoiler && 'scale-110 blur-xl'
  )

  const spoilerOverlay = isSpoiler ? (
    <span className="bg-base-content/35 text-base-100 absolute inset-0 flex items-center justify-center text-xs font-medium">
      Tap to reveal
    </span>
  ) : null

  if (!resolvedUrl && !showUnavailable) {
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

  if (showUnavailable || !resolvedUrl) {
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
        onClick={handleActivate}>
        <span
          aria-hidden
          className={twMerge('absolute inset-0', imageLayerClass)}
          style={coverStyle}
        />
        {spoilerOverlay}
        <img
          src={resolvedUrl}
          alt={alt}
          className="sr-only"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
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
      <img
        src={resolvedUrl}
        alt={alt}
        className="sr-only"
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    </button>
  )
}
