import { GallerySpoilerRevealControl } from '@components/chatroom/components/MediaSpoilerReveal'
import { useGalleryZoomPan } from '@components/chatroom/hooks/useGalleryZoomPan'
import { useFeedMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import {
  publishGalleryActiveMediaUrl,
  registerGalleryMediaController,
  registerGalleryZoomController
} from '@components/chatroom/stores/chatMediaGalleryStore'
import { useFeedSpoilerGate } from '@components/chatroom/utils/feedSpoilerReveal'
import { type GalleryMediaItem, mediaKey } from '@components/chatroom/utils/galleryPlaylist'
import { prefersReducedMotion } from '@utils/motion'
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { MediaUnavailable } from '../MessageCard/components/MessageContent/components/MediaUnavailable'

type GallerySlideProps = {
  media: GalleryMediaItem
  slideIndex: number
  autoplayIndex: number
  isActive: boolean
  onZoomedChange?: (zoomed: boolean) => void
}

type GalleryImageSlideProps = Pick<GallerySlideProps, 'media' | 'isActive' | 'onZoomedChange'>

type SlideKind = 'image' | 'video' | 'audio'

type VisibilityRef = (node: HTMLElement | null) => void

function GallerySlideShell({
  visibilityRef,
  className,
  children
}: {
  visibilityRef: VisibilityRef
  className?: string
  children: ReactNode
}) {
  return (
    <div
      ref={visibilityRef}
      className={twMerge('flex h-full w-full items-center justify-center', className)}>
      {children}
    </div>
  )
}

function GalleryLoadingBone({ kind, className }: { kind: SlideKind; className?: string }) {
  if (kind === 'audio') {
    return <div className={twMerge('skeleton h-24 w-full max-w-md', className)} aria-hidden />
  }
  return (
    <div
      className={twMerge(
        'skeleton max-h-[calc(100dvh-7rem)] w-full max-w-[min(96vw,1200px)]',
        className
      )}
      aria-hidden
    />
  )
}

function GallerySpoilerChipShell({
  visibilityRef,
  kind,
  reveal
}: {
  visibilityRef: VisibilityRef
  kind: SlideKind
  reveal: () => void
}) {
  return (
    <GallerySlideShell visibilityRef={visibilityRef} className="relative px-4">
      <GalleryLoadingBone kind={kind} className="scale-110 blur-xl" />
      <GallerySpoilerRevealControl kind={kind} reveal={reveal} variant="chip" />
    </GallerySlideShell>
  )
}

function usePublishActiveResolvedUrl(isActive: boolean, url: string | null) {
  useEffect(() => {
    if (!isActive) return
    publishGalleryActiveMediaUrl(url)
  }, [isActive, url])
}

function usePauseMediaOnInactive(ref: RefObject<HTMLMediaElement | null>, isActive: boolean) {
  useEffect(() => {
    if (!isActive) ref.current?.pause()
  }, [isActive, ref])
}

function GalleryImageSlide({ media, isActive, onZoomedChange }: GalleryImageSlideProps) {
  const slideKey = mediaKey(media)
  const {
    url: resolvedUrl,
    ref: visibilityRef,
    signFailed,
    retry
  } = useFeedMediaDisplayUrl(media, { eager: true })
  const [imgFailed, setImgFailed] = useState(false)
  const { isSpoiler, reveal } = useFeedSpoilerGate(media)
  const alt = media.name?.trim() || 'Image attachment'
  const showUnavailable = imgFailed || signFailed || !resolvedUrl
  const isLoading = !resolvedUrl && !imgFailed && !signFailed

  const zoomEnabled = !isSpoiler && Boolean(resolvedUrl) && !showUnavailable
  const {
    reset: resetZoom,
    zoomInAtCenter,
    zoomStepInAtCenter,
    zoomStepOutAtCenter,
    panBy,
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
  } = useGalleryZoomPan(zoomEnabled, slideKey)

  usePublishActiveResolvedUrl(isActive, showUnavailable || !resolvedUrl ? null : resolvedUrl)

  useEffect(() => {
    onZoomedChange?.(isZoomed)
  }, [isZoomed, onZoomedChange])

  useEffect(() => {
    if (!isActive) return
    if (!zoomEnabled) {
      registerGalleryZoomController(slideKey, null)
      return
    }
    registerGalleryZoomController(slideKey, {
      zoomInAtCenter,
      zoomStepInAtCenter,
      zoomStepOutAtCenter,
      reset: resetZoom,
      panBy
    })
    return () => registerGalleryZoomController(slideKey, null)
  }, [
    isActive,
    panBy,
    resetZoom,
    slideKey,
    zoomEnabled,
    zoomInAtCenter,
    zoomStepInAtCenter,
    zoomStepOutAtCenter
  ])

  const handleRetry = () => {
    setImgFailed(false)
    retry()
  }

  if (isLoading) {
    if (isSpoiler) {
      return <GallerySpoilerChipShell visibilityRef={visibilityRef} kind="image" reveal={reveal} />
    }
    return (
      <GallerySlideShell visibilityRef={visibilityRef}>
        <GalleryLoadingBone kind="image" />
      </GallerySlideShell>
    )
  }

  if (showUnavailable) {
    return (
      <GallerySlideShell visibilityRef={visibilityRef} className="px-6">
        <MediaUnavailable label="Image unavailable" kind="image" onRetry={handleRetry} />
      </GallerySlideShell>
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
      src={resolvedUrl}
      alt={alt}
      className={imageClassName}
      draggable={false}
      style={transform ? { transform, transformOrigin: 'center center' } : undefined}
      onError={() => setImgFailed(true)}
    />
  )

  if (isSpoiler) {
    return (
      <GallerySlideShell visibilityRef={visibilityRef} className="relative">
        <GallerySpoilerRevealControl kind="image" reveal={reveal} variant="veil">
          {imageNode}
        </GallerySpoilerRevealControl>
      </GallerySlideShell>
    )
  }

  return (
    <div
      ref={(node) => {
        visibilityRef(node)
        connectHostRef(node)
      }}
      className={[
        'relative flex h-full w-full touch-none items-center justify-center overflow-hidden px-4',
        isZoomed && 'overscroll-none'
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
  autoplayIndex,
  isActive,
  kind
}: GallerySlideProps & { kind: 'video' | 'audio' }) {
  const slideKey = mediaKey(media)
  const {
    url: resolvedUrl,
    ref: visibilityRef,
    signFailed,
    retry
  } = useFeedMediaDisplayUrl(media, { eager: true })
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null)
  const { isSpoiler, reveal } = useFeedSpoilerGate(media)
  const label = media.name?.trim() || (kind === 'video' ? 'Video attachment' : 'Audio attachment')
  const canPlay = Boolean(resolvedUrl) && !signFailed && !isSpoiler
  const autoPlay = canPlay && slideIndex === autoplayIndex && isActive && !prefersReducedMotion()

  usePublishActiveResolvedUrl(isActive, signFailed || !resolvedUrl ? null : resolvedUrl)
  usePauseMediaOnInactive(mediaRef, isActive)

  const togglePlayback = useCallback(() => {
    const el = mediaRef.current
    if (!(el instanceof HTMLVideoElement)) return
    if (el.paused) void el.play().catch(() => undefined)
    else el.pause()
  }, [])

  useEffect(() => {
    if (!isActive || !canPlay || kind !== 'video') return
    registerGalleryMediaController(slideKey, { togglePlayback })
    return () => registerGalleryMediaController(slideKey, null)
  }, [canPlay, isActive, kind, slideKey, togglePlayback])

  if (isSpoiler) {
    return <GallerySpoilerChipShell visibilityRef={visibilityRef} kind={kind} reveal={reveal} />
  }

  if (signFailed) {
    return (
      <GallerySlideShell visibilityRef={visibilityRef} className="px-6">
        <MediaUnavailable
          label={kind === 'video' ? 'Video unavailable' : 'Audio unavailable'}
          kind={kind}
          onRetry={retry}
        />
      </GallerySlideShell>
    )
  }

  if (!resolvedUrl) {
    return (
      <GallerySlideShell visibilityRef={visibilityRef}>
        <GalleryLoadingBone kind={kind} />
      </GallerySlideShell>
    )
  }

  if (kind === 'video') {
    return (
      <GallerySlideShell visibilityRef={visibilityRef} className="px-4">
        <video
          ref={mediaRef as RefObject<HTMLVideoElement>}
          src={resolvedUrl}
          controls
          autoPlay={autoPlay}
          playsInline
          className="max-h-[calc(100dvh-7rem)] max-w-[min(96vw,1200px)] bg-black object-contain"
          aria-label={label}
        />
      </GallerySlideShell>
    )
  }

  return (
    <GallerySlideShell visibilityRef={visibilityRef} className="flex-col px-6">
      <p className="mb-4 max-w-md truncate text-center text-sm text-white/70">{label}</p>
      <audio
        ref={mediaRef as RefObject<HTMLAudioElement>}
        src={resolvedUrl}
        controls
        autoPlay={autoPlay}
        className="w-full max-w-md"
        aria-label={label}
      />
    </GallerySlideShell>
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
