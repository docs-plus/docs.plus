import { useCallback, useEffect } from 'react'

type Options = {
  isOpen: boolean
  slideZoomed: boolean
  itemCount: number
  closeGallery: () => void
  step: (delta: -1 | 1) => void
  requestZoomReset: () => void
}

export function useGalleryKeyboard({
  isOpen,
  slideZoomed,
  itemCount,
  closeGallery,
  step,
  requestZoomReset
}: Options) {
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        event.preventDefault()
        if (slideZoomed) {
          event.stopPropagation()
          requestZoomReset()
        } else {
          closeGallery()
        }
        return
      }

      if (itemCount <= 1 || slideZoomed) return
      const target = event.target
      if (target instanceof HTMLVideoElement || target instanceof HTMLAudioElement) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        step(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        step(1)
      }
    },
    [closeGallery, isOpen, itemCount, slideZoomed, requestZoomReset, step]
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])
}
