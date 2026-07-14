import { useChatMediaGalleryStore } from '@components/chatroom/stores/chatMediaGalleryStore'
import { useEffect } from 'react'

/** ~10% of a typical lightbox stage; keeps arrow-pan snappy without flying off-screen. */
const KEYBOARD_PAN_PX = 80

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

type UseGalleryKeyboardArgs = {
  isOpen: boolean
  slideZoomed: boolean
  itemCount: number
  /** image | video | audio — zoom keys only for images. */
  activeType: 'image' | 'video' | 'audio' | undefined
  closeGallery: () => void
  step: (delta: -1 | 1) => void
}

/**
 * Discord-aligned lightbox shortcuts. Zoom/pan/playback hit the active-slide
 * controllers registered by GallerySlide (not a nonce command bus).
 */
export function useGalleryKeyboard({
  isOpen,
  slideZoomed,
  itemCount,
  activeType,
  closeGallery,
  step
}: UseGalleryKeyboardArgs): void {
  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (isTypingTarget(event.target)) return
      // Leave browser/page zoom alone (Ctrl/Cmd ± 0).
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target
      const focusOnMedia = target instanceof HTMLVideoElement || target instanceof HTMLAudioElement

      const {
        requestZoomOut,
        requestZoomReset,
        requestZoomStepIn,
        requestPan,
        requestTogglePlayback
      } = useChatMediaGalleryStore.getState()

      switch (event.key) {
        case 'Escape': {
          event.preventDefault()
          if (slideZoomed) {
            event.stopPropagation()
            requestZoomReset()
          } else {
            closeGallery()
          }
          return
        }
        case 'ArrowLeft': {
          if (focusOnMedia && !slideZoomed) return
          event.preventDefault()
          if (slideZoomed) {
            requestPan(KEYBOARD_PAN_PX, 0)
          } else if (itemCount > 1) {
            step(-1)
          }
          return
        }
        case 'ArrowRight': {
          if (focusOnMedia && !slideZoomed) return
          event.preventDefault()
          if (slideZoomed) {
            requestPan(-KEYBOARD_PAN_PX, 0)
          } else if (itemCount > 1) {
            step(1)
          }
          return
        }
        case 'ArrowUp': {
          if (!slideZoomed) return
          event.preventDefault()
          requestPan(0, KEYBOARD_PAN_PX)
          return
        }
        case 'ArrowDown': {
          if (!slideZoomed) return
          event.preventDefault()
          requestPan(0, -KEYBOARD_PAN_PX)
          return
        }
        case '+':
        case '=': {
          if (activeType !== 'image') return
          event.preventDefault()
          requestZoomStepIn()
          return
        }
        case '-':
        case '_': {
          if (activeType !== 'image' || !slideZoomed) return
          event.preventDefault()
          requestZoomOut()
          return
        }
        case '0': {
          if (activeType !== 'image' || !slideZoomed) return
          event.preventDefault()
          requestZoomReset()
          return
        }
        case ' ': {
          if (activeType !== 'video') return
          event.preventDefault()
          requestTogglePlayback()
          return
        }
        default:
          return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeType, closeGallery, isOpen, itemCount, slideZoomed, step])
}
