import { type RefObject, useLayoutEffect } from 'react'

export type ScrollFade = false | 'start' | 'end' | 'both'

type ScrollOverflow = 'none' | 'start' | 'end' | 'both'

/** Rubber-band overshoot sits in this band; a tighter epsilon flickers the mask. */
const SCROLL_OVERFLOW_EPSILON_PX = 6

function readScrollOverflow(el: HTMLElement): ScrollOverflow {
  const maxScroll = el.scrollHeight - el.clientHeight

  if (maxScroll <= SCROLL_OVERFLOW_EPSILON_PX) return 'none'

  const canStart = el.scrollTop > SCROLL_OVERFLOW_EPSILON_PX
  const canEnd = el.scrollTop < maxScroll - SCROLL_OVERFLOW_EPSILON_PX

  if (canStart && canEnd) return 'both'

  if (canStart) return 'start'

  if (canEnd) return 'end'

  return 'none'
}

function writeScrollOverflow(el: HTMLElement, next: ScrollOverflow): void {
  if (el.dataset.scrollOverflow === next) return
  el.dataset.scrollOverflow = next
}

/** Observes the first child: the scroller box does not grow when the outline does. */
export function useScrollOverflow(
  elementRef: RefObject<HTMLElement | null>,
  fade: ScrollFade
): void {
  useLayoutEffect(() => {
    if (!fade) return
    const el = elementRef.current

    if (!el) return

    let frame = 0

    const sync = () => {
      writeScrollOverflow(el, readScrollOverflow(el))
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        sync()
      })
    }

    sync()
    el.addEventListener('scroll', schedule, { passive: true })

    const observer = new ResizeObserver(schedule)
    observer.observe(el)

    if (el.firstElementChild) observer.observe(el.firstElementChild)

    return () => {
      el.removeEventListener('scroll', schedule)
      observer.disconnect()

      if (frame) cancelAnimationFrame(frame)
      el.removeAttribute('data-scroll-overflow')
    }
  }, [elementRef, fade])
}
