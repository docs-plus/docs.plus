import { useMediaDisplayUrl } from '@components/chatroom/hooks/useMediaSignedUrl'
import { useChatMediaGalleryStore } from '@components/chatroom/stores/chatMediaGalleryStore'
import { modalBackdropHeavyClassName } from '@components/ui/Dialog'
import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  useTransitionStyles
} from '@floating-ui/react'
import { Icons } from '@icons'
import type { MessageMediaItem } from '@types'
import { MOTION_DIALOG_IN_MS, MOTION_DIALOG_OUT_MS, prefersReducedMotion } from '@utils/motion'
import { useCallback, useEffect, useRef } from 'react'

function GalleryVideo({ media }: { media: MessageMediaItem }) {
  const resolvedUrl = useMediaDisplayUrl(media)
  const label = media.name?.trim() || 'Video attachment'

  if (!resolvedUrl) {
    return (
      <div className="text-base-100 flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-sm">
        <Icons.video size={32} aria-hidden />
        <span>Video unavailable</span>
      </div>
    )
  }

  return (
    <video
      src={resolvedUrl}
      controls
      autoPlay={!prefersReducedMotion()}
      playsInline
      className="max-h-[min(85dvh,900px)] max-w-[min(100vw-2rem,960px)] rounded-lg bg-black"
      aria-label={label}
    />
  )
}

function GalleryImage({ media }: { media: MessageMediaItem }) {
  const resolvedUrl = useMediaDisplayUrl(media)
  const alt = media.name?.trim() || 'Image attachment'

  if (!resolvedUrl) {
    return (
      <div className="text-base-100 flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-sm">
        <Icons.image size={32} aria-hidden />
        <span>Image unavailable</span>
      </div>
    )
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className="max-h-[min(85dvh,900px)] max-w-[min(100vw-2rem,960px)] rounded-lg object-contain select-none"
      draggable={false}
    />
  )
}

export function ChatMediaGallery() {
  const isOpen = useChatMediaGalleryStore((s) => s.isOpen)
  const images = useChatMediaGalleryStore((s) => s.images)
  const video = useChatMediaGalleryStore((s) => s.video)
  const index = useChatMediaGalleryStore((s) => s.index)
  const closeGallery = useChatMediaGalleryStore((s) => s.closeGallery)
  const step = useChatMediaGalleryStore((s) => s.step)

  const touchStartX = useRef<number | null>(null)

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) closeGallery()
    }
  })

  const dismiss = useDismiss(context, { outsidePressEvent: 'mousedown', escapeKey: true })
  const role = useRole(context, { role: 'dialog' })
  const { getFloatingProps } = useInteractions([dismiss, role])

  const reduced = prefersReducedMotion()
  const { isMounted, styles: backdropStyles } = useTransitionStyles(context, {
    duration: reduced ? 0 : { open: MOTION_DIALOG_OUT_MS, close: MOTION_DIALOG_OUT_MS },
    initial: { opacity: 0 },
    close: { opacity: 0, transitionTimingFunction: 'ease-in' }
  })
  const { styles: cardStyles } = useTransitionStyles(context, {
    duration: reduced ? 0 : { open: MOTION_DIALOG_IN_MS, close: MOTION_DIALOG_OUT_MS },
    initial: { opacity: 0, transform: 'scale(0.98)' },
    close: { opacity: 0, transitionTimingFunction: 'ease-in' }
  })

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Image gallery only — in video mode leave ←/→ to native <video> seeking.
      if (!isOpen || video != null || images.length <= 1) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        step(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        step(1)
      }
    },
    [isOpen, video, images.length, step]
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null || images.length <= 1) return
    const end = event.changedTouches[0]?.clientX
    if (end == null) return
    const delta = end - start
    if (Math.abs(delta) < 48) return
    step(delta > 0 ? -1 : 1)
  }

  if (!isMounted || !isOpen) return null

  const isVideoMode = video != null
  const media = isVideoMode ? video : images[index]
  if (!media) return null

  return (
    <FloatingPortal>
      <FloatingOverlay
        className={`fixed inset-0 z-[100] ${modalBackdropHeavyClassName}`}
        style={backdropStyles}
        lockScroll
        data-testid="chat-media-gallery">
        <FloatingFocusManager context={context} modal>
          <div
            ref={refs.setFloating}
            className="fixed inset-0 flex flex-col items-center justify-center p-4"
            aria-label={isVideoMode ? 'Video player' : 'Image gallery'}
            {...getFloatingProps()}
            onTouchStart={isVideoMode ? undefined : onTouchStart}
            onTouchEnd={isVideoMode ? undefined : onTouchEnd}>
            <div
              style={cardStyles}
              className="relative flex w-full max-w-5xl flex-col items-center">
              {!isVideoMode && images.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="btn btn-circle btn-ghost btn-sm text-base-100 absolute top-1/2 left-0 z-10 -translate-y-1/2 disabled:opacity-30"
                    disabled={index === 0}
                    aria-label="Previous image"
                    onClick={() => step(-1)}>
                    <Icons.chevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-circle btn-ghost btn-sm text-base-100 absolute top-1/2 right-0 z-10 -translate-y-1/2 disabled:opacity-30"
                    disabled={index >= images.length - 1}
                    aria-label="Next image"
                    onClick={() => step(1)}>
                    <Icons.chevronRight size={22} />
                  </button>
                </>
              ) : null}

              {isVideoMode ? <GalleryVideo media={media} /> : <GalleryImage media={media} />}

              <div className="mt-3 flex w-full items-center justify-center gap-3">
                {!isVideoMode && images.length > 1 ? (
                  <span className="text-base-100/90 text-xs tabular-nums">
                    {index + 1} / {images.length}
                  </span>
                ) : null}
                {media.name ? (
                  <span className="text-base-100/70 max-w-[min(60vw,20rem)] truncate text-xs">
                    {media.name}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                className="btn btn-circle btn-ghost btn-sm text-base-100 absolute top-2 right-2"
                aria-label="Close gallery"
                onClick={() => closeGallery()}>
                <Icons.close size={18} />
              </button>
            </div>
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  )
}
