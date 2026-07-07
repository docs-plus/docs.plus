import { useGalleryCarousel } from '@components/chatroom/hooks/useGalleryCarousel'
import { useGalleryKeyboard } from '@components/chatroom/hooks/useGalleryKeyboard'
import { useChatMediaGalleryStore } from '@components/chatroom/stores/chatMediaGalleryStore'
import { galleryLightboxThemeStyle } from '@components/chatroom/utils/galleryLightboxTheme'
import { saveMediaFile } from '@components/chatroom/utils/galleryMediaActions'
import { mediaKey } from '@components/chatroom/utils/galleryPlaylist'
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
import { useChatStore } from '@stores'
import {
  MOTION_DIALOG_IN_MS,
  MOTION_DIALOG_OUT_MS,
  MOTION_PANEL_MS,
  prefersReducedMotion
} from '@utils/motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useShallow } from 'zustand/react/shallow'

import { GallerySlide } from './GallerySlide'
import { GalleryToolbar } from './GalleryToolbar'

const NAV_BTN =
  'absolute top-1/2 z-30 flex size-11 min-h-11 min-w-11 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-[var(--gallery-nav-bg)] text-white shadow-lg transition hover:bg-[var(--gallery-nav-hover)] disabled:pointer-events-none disabled:opacity-0 motion-safe:transition-opacity'

const pauseStageMedia = (root: HTMLElement | null) => {
  root?.querySelectorAll('video, audio').forEach((el) => {
    if (el instanceof HTMLMediaElement) el.pause()
  })
}

export function ChatMediaGallery() {
  const { isOpen, items, index, openIndex, originMessage, source, caption, activeResolvedUrl } =
    useChatMediaGalleryStore(
      useShallow((s) => ({
        isOpen: s.isOpen,
        items: s.items,
        index: s.index,
        openIndex: s.openIndex,
        originMessage: s.originMessage,
        source: s.source,
        caption: s.caption,
        activeResolvedUrl: s.activeResolvedUrl
      }))
    )
  const closeGallery = useChatMediaGalleryStore((s) => s.closeGallery)
  const step = useChatMediaGalleryStore((s) => s.step)
  const requestZoomIn = useChatMediaGalleryStore((s) => s.requestZoomIn)
  const requestZoomReset = useChatMediaGalleryStore((s) => s.requestZoomReset)
  const activeChannelId = useChatStore((s) => s.chatRoom.headingId)
  const stageRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)
  const prevChannelIdRef = useRef<string | undefined>(undefined)
  const [slideZoomed, setSlideZoomed] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const reduced = prefersReducedMotion()
  const controlsMotionStyle = reduced ? undefined : { transitionDuration: `${MOTION_PANEL_MS}ms` }

  const carousel = useGalleryCarousel({
    index,
    count: items.length,
    enabled: isOpen && items.length > 1 && !slideZoomed,
    onStep: step
  })

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) closeGallery()
    }
  })

  const dismiss = useDismiss(context, { outsidePressEvent: 'pointerdown', escapeKey: false })
  const role = useRole(context, { role: 'dialog' })
  const { getFloatingProps } = useInteractions([dismiss, role])

  const { isMounted, styles: backdropStyles } = useTransitionStyles(context, {
    duration: reduced ? 0 : { open: MOTION_DIALOG_IN_MS, close: MOTION_DIALOG_OUT_MS },
    initial: { opacity: 0 },
    close: { opacity: 0, transitionTimingFunction: 'ease-in' }
  })

  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement
      return
    }

    pauseStageMedia(stageRef.current)
    setSlideZoomed(false)
    prevChannelIdRef.current = undefined

    const opener = openerRef.current
    if (opener instanceof HTMLElement) {
      opener.focus()
    }
    openerRef.current = null
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setControlsVisible(true)
    setSlideZoomed(false)
    pauseStageMedia(stageRef.current)
  }, [index, isOpen])

  const handleReply = useCallback(() => {
    if (!originMessage) return

    closeGallery()
    useChatStore.getState().setReplyMessageMemory(originMessage.channel_id, originMessage)
    document.dispatchEvent(new CustomEvent('editor:focus'))
  }, [closeGallery, originMessage])

  useEffect(() => {
    const galleryChannelId = originMessage?.channel_id
    if (!isOpen || !galleryChannelId || !activeChannelId) return
    if (prevChannelIdRef.current === activeChannelId) return
    prevChannelIdRef.current = activeChannelId
    if (galleryChannelId !== activeChannelId) closeGallery()
  }, [activeChannelId, closeGallery, isOpen, originMessage?.channel_id])

  const handleStageClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (slideZoomed) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('button, a, video, audio')) return
      setControlsVisible((visible) => !visible)
    },
    [slideZoomed]
  )

  useGalleryKeyboard({
    isOpen,
    slideZoomed,
    itemCount: items.length,
    closeGallery,
    step,
    requestZoomReset
  })

  const handleDownload = useCallback(async () => {
    const media = items[index]
    if (!media || downloading) return

    setDownloading(true)
    try {
      await saveMediaFile(media)
    } finally {
      setDownloading(false)
    }
  }, [downloading, index, items])

  if (!isMounted || !isOpen || items.length === 0) return null

  const multiItem = items.length > 1
  const activeMedia = items[index]!

  return (
    <FloatingPortal>
      <FloatingOverlay
        className={twMerge(
          modalBackdropHeavyClassName,
          'fixed inset-x-0 top-0 z-[100] h-[100dvh] min-h-0 overscroll-none'
        )}
        style={backdropStyles}
        lockScroll
        data-testid="chat-media-gallery">
        <FloatingFocusManager context={context} modal>
          <div
            ref={refs.setFloating}
            className="flex h-full min-h-0 flex-col overscroll-none bg-black text-white"
            style={galleryLightboxThemeStyle}
            aria-label="Media gallery"
            {...getFloatingProps()}>
            <GalleryToolbar
              media={activeMedia}
              multiItem={multiItem}
              index={index}
              total={items.length}
              slideZoomed={slideZoomed}
              controlsVisible={controlsVisible}
              controlsMotionStyle={controlsMotionStyle}
              downloading={downloading}
              source={source}
              caption={caption}
              originMessage={originMessage}
              activeResolvedUrl={activeResolvedUrl}
              onClose={closeGallery}
              onDownload={() => void handleDownload()}
              onZoomIn={requestZoomIn}
              onZoomReset={requestZoomReset}
              onReply={handleReply}
            />

            <div
              className="relative flex min-h-0 flex-1 flex-col pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              onClick={handleStageClick}>
              {multiItem ? (
                <>
                  <button
                    type="button"
                    className={twMerge(
                      NAV_BTN,
                      'left-[max(0.75rem,env(safe-area-inset-left))]',
                      !controlsVisible && 'pointer-events-none opacity-0'
                    )}
                    style={controlsMotionStyle}
                    disabled={index === 0 || slideZoomed}
                    aria-label="Previous media"
                    onClick={() => step(-1)}>
                    <Icons.chevronLeft size={24} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    className={twMerge(
                      NAV_BTN,
                      'right-[max(0.75rem,env(safe-area-inset-right))]',
                      !controlsVisible && 'pointer-events-none opacity-0'
                    )}
                    style={controlsMotionStyle}
                    disabled={index >= items.length - 1 || slideZoomed}
                    aria-label="Next media"
                    onClick={() => step(1)}>
                    <Icons.chevronRight size={24} strokeWidth={2.5} />
                  </button>
                </>
              ) : null}

              <div
                ref={carousel.viewportRef}
                className={[
                  'h-full overflow-hidden',
                  slideZoomed ? 'touch-none' : 'touch-pan-x touch-pinch-zoom'
                ].join(' ')}
                onPointerDown={carousel.onPointerDown}
                onPointerMove={carousel.onPointerMove}
                onPointerUp={carousel.onPointerUp}
                onPointerCancel={carousel.onPointerCancel}
                onTouchStart={carousel.onTouchStart}
                onTouchEnd={carousel.onTouchEnd}>
                <div ref={stageRef} className="flex h-full" style={carousel.trackStyle}>
                  {items.map((item, slideIndex) => {
                    const nearActive = Math.abs(slideIndex - index) <= 1

                    return (
                      <div
                        key={mediaKey(item)}
                        className="flex h-full min-w-full shrink-0 items-center justify-center"
                        aria-hidden={slideIndex !== index}>
                        {nearActive ? (
                          <GallerySlide
                            media={item}
                            slideIndex={slideIndex}
                            openIndex={openIndex}
                            isActive={slideIndex === index}
                            onZoomedChange={slideIndex === index ? setSlideZoomed : undefined}
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  )
}
