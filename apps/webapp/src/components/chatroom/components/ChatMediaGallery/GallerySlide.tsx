import {
  usePauseMediaOnInactive,
  usePublishActiveResolvedUrl
} from '@components/chatroom/hooks/useGallerySlideSync'
import { useGalleryZoomPan } from '@components/chatroom/hooks/useGalleryZoomPan'
import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { useChatMediaGalleryStore } from '@components/chatroom/stores/chatMediaGalleryStore'
import {
  markFeedSpoilerRevealed,
  useFeedSpoilerRevealed
} from '@components/chatroom/utils/feedSpoilerReveal'
import { type GalleryMediaItem, mediaKey } from '@components/chatroom/utils/galleryPlaylist'
import { prefersReducedMotion } from '@utils/motion'
import { type RefObject, useEffect, useRef, useState } from 'react'

import { MediaUnavailable } from '../MessageCard/components/MessageContent/components/MediaUnavailable'

type GallerySlideProps = {
  media: GalleryMediaItem
  slideIndex: number
  openIndex: number
  isActive: boolean
  onZoomedChange?: (zoomed: boolean) => void
}

type GalleryImageSlideProps = Pick<GallerySlideProps, 'media' | 'isActive' | 'onZoomedChange'>

function GalleryImageSlide({ media, isActive, onZoomedChange }: GalleryImageSlideProps) {
  const {
    url: resolvedUrl,
    ref: visibilityRef,
    signFailed,
    retry
  } = useFeedMediaDisplayUrl(media, { eager: true })
  const [imgFailed, setImgFailed] = useState(false)
  const revealed = useFeedSpoilerRevealed(media)
  const isSpoiler = Boolean(media.spoiler) && !revealed
  const alt = media.name?.trim() || 'Image attachment'
  const showUnavailable = imgFailed || signFailed || !resolvedUrl

  const zoomEnabled = !isSpoiler && Boolean(resolvedUrl) && !showUnavailable
  const zoom = useGalleryZoomPan(zoomEnabled, mediaKey(media))
  const {
    reset: resetZoom,
    zoomInAtCenter,
    isZoomed,
    cursorClass,
    transform,
    connectHostRef,
    onWheel,
    onClick,
    onDoubleClick,
    onPointerDown,
    onPointerMove,
    onPointerUp
  } = zoom
  const zoomRequest = useChatMediaGalleryStore((s) => s.zoomRequest)
  const zoomResetRequest = useChatMediaGalleryStore((s) => s.zoomResetRequest)

  usePublishActiveResolvedUrl(isActive, showUnavailable || !resolvedUrl ? null : resolvedUrl)

  useEffect(() => {
    onZoomedChange?.(isZoomed)
  }, [isZoomed, onZoomedChange])

  useEffect(() => {
    if (!isActive) {
      resetZoom()
      return
    }
    if (zoomResetRequest > 0) resetZoom()
  }, [isActive, resetZoom, zoomResetRequest])

  useEffect(() => {
    if (!isActive || !zoomEnabled || zoomRequest === 0) return
    zoomInAtCenter()
  }, [isActive, zoomEnabled, zoomInAtCenter, zoomRequest])

  const handleRetry = () => {
    setImgFailed(false)
    retry()
  }

  const handleReveal = () => {
    markFeedSpoilerRevealed(media)
  }

  if (isSpoiler && !resolvedUrl && !imgFailed) {
    return (
      <div
        ref={visibilityRef}
        className="relative flex h-full w-full items-center justify-center px-4">
        <div
          className="skeleton max-h-[calc(100dvh-7rem)] w-full max-w-[min(96vw,1200px)] scale-110 blur-xl"
          aria-hidden
        />
        <button
          type="button"
          className="absolute inset-0 flex cursor-pointer items-center justify-center border-0 bg-transparent p-0"
          aria-label="Reveal spoiler image"
          data-testid="gallery-spoiler-reveal"
          onClick={handleReveal}>
          <span className="rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white">
            Tap to reveal
          </span>
        </button>
      </div>
    )
  }

  if (!resolvedUrl && !imgFailed && !signFailed) {
    return (
      <div
        ref={visibilityRef}
        className="skeleton max-h-[calc(100dvh-7rem)] w-full max-w-[min(96vw,1200px)]"
        aria-hidden
      />
    )
  }

  if (showUnavailable && !isSpoiler) {
    return (
      <div ref={visibilityRef} className="flex h-full w-full items-center justify-center px-6">
        <MediaUnavailable label="Image unavailable" kind="image" onRetry={handleRetry} />
      </div>
    )
  }

  const imageClassName = [
    'max-h-[calc(100dvh-7rem)] max-w-[min(96vw,1200px)] object-contain select-none touch-manipulation [touch-callout:none]',
    isSpoiler && 'scale-110 blur-xl',
    cursorClass
  ]
    .filter(Boolean)
    .join(' ')

  const zoomSurfaceProps = zoomEnabled
    ? {
        onWheel,
        onClick,
        onDoubleClick,
        onPointerDown,
        onPointerMove,
        onPointerUp
      }
    : {}

  const imageNode = (
    <img
      src={resolvedUrl!}
      alt={alt}
      className={imageClassName}
      draggable={false}
      style={transform ? { transform, transformOrigin: 'center center' } : undefined}
      onError={() => setImgFailed(true)}
    />
  )

  if (isSpoiler) {
    return (
      <div ref={visibilityRef} className="relative flex h-full w-full items-center justify-center">
        <button
          type="button"
          className="relative block cursor-pointer overflow-hidden border-0 bg-transparent p-0"
          aria-label="Reveal spoiler image"
          data-testid="gallery-spoiler-reveal"
          onClick={handleReveal}>
          {imageNode}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
            Tap to reveal
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      ref={(node) => {
        visibilityRef(node)
        connectHostRef(node)
      }}
      className={[
        'flex h-full w-full items-center justify-center overflow-hidden px-4',
        isZoomed && 'touch-none overscroll-none'
      ]
        .filter(Boolean)
        .join(' ')}
      {...zoomSurfaceProps}>
      {imageNode}
    </div>
  )
}

function GalleryAvSlide({
  media,
  slideIndex,
  openIndex,
  isActive,
  kind
}: GallerySlideProps & { kind: 'video' | 'audio' }) {
  const {
    url: resolvedUrl,
    ref: visibilityRef,
    signFailed,
    retry
  } = useFeedMediaDisplayUrl(media, { eager: true })
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null)
  const label = media.name?.trim() || (kind === 'video' ? 'Video attachment' : 'Audio attachment')
  const autoPlay = slideIndex === openIndex && isActive && !prefersReducedMotion()

  usePublishActiveResolvedUrl(isActive, signFailed || !resolvedUrl ? null : resolvedUrl)
  usePauseMediaOnInactive(mediaRef, isActive)

  if (signFailed) {
    return (
      <div ref={visibilityRef} className="flex h-full w-full items-center justify-center px-6">
        <MediaUnavailable
          label={kind === 'video' ? 'Video unavailable' : 'Audio unavailable'}
          kind={kind}
          onRetry={retry}
        />
      </div>
    )
  }

  if (!resolvedUrl) {
    return kind === 'video' ? (
      <div
        ref={visibilityRef}
        className="skeleton max-h-[calc(100dvh-7rem)] w-full max-w-[min(96vw,1200px)]"
        aria-hidden
      />
    ) : (
      <div ref={visibilityRef} className="skeleton h-24 w-full max-w-md" aria-hidden />
    )
  }

  if (kind === 'video') {
    return (
      <div ref={visibilityRef} className="flex h-full w-full items-center justify-center px-4">
        <video
          ref={mediaRef as RefObject<HTMLVideoElement>}
          src={resolvedUrl}
          controls
          autoPlay={autoPlay}
          playsInline
          className="max-h-[calc(100dvh-7rem)] max-w-[min(96vw,1200px)] bg-black object-contain"
          aria-label={label}
        />
      </div>
    )
  }

  return (
    <div
      ref={visibilityRef}
      className="flex h-full w-full flex-col items-center justify-center px-6">
      <p className="mb-4 max-w-md truncate text-center text-sm text-white/70">{label}</p>
      <audio
        ref={mediaRef as RefObject<HTMLAudioElement>}
        src={resolvedUrl}
        controls
        autoPlay={autoPlay}
        className="w-full max-w-md"
        aria-label={label}
      />
    </div>
  )
}

export function GallerySlide(props: GallerySlideProps) {
  switch (props.media.type) {
    case 'image':
      return <GalleryImageSlide {...props} />
    case 'video':
      return <GalleryAvSlide {...props} kind="video" />
    case 'audio':
      return <GalleryAvSlide {...props} kind="audio" />
    default: {
      const _exhaustive: never = props.media.type
      return null
    }
  }
}
