import { useVirtuosoMethods } from '@virtuoso.dev/message-list'
import { useEffect, useState } from 'react'

import { FeedSeparator } from './FeedSeparator'

const HIDE_AFTER_MS = 1500

export const StickyDayHeader = () => {
  const methods = useVirtuosoMethods()
  const [date, setDate] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null

    const tryAttach = () => {
      if (cancelled) return
      const scroller = methods.scrollerElement()
      if (!scroller) {
        requestAnimationFrame(tryAttach)
        return
      }

      let rafId: number | null = null
      let hideTimer: number | null = null

      const scheduleHide = () => {
        if (hideTimer != null) window.clearTimeout(hideTimer)
        hideTimer = window.setTimeout(() => {
          hideTimer = null
          setVisible(false)
        }, HIDE_AFTER_MS)
      }

      const update = () => {
        rafId = null
        const scrollerRect = scroller.getBoundingClientRect()
        const nodes = scroller.querySelectorAll<HTMLElement>('[data-msg-date]')
        let topDate: string | null = null
        for (const node of nodes) {
          const r = node.getBoundingClientRect()
          if (r.bottom > scrollerRect.top + 1) {
            topDate = node.dataset.msgDate ?? null
            break
          }
        }
        setDate((prev) => (prev === topDate ? prev : topDate))
      }

      const onScroll = () => {
        setVisible(true)
        scheduleHide()
        if (rafId == null) rafId = requestAnimationFrame(update)
      }

      scroller.addEventListener('scroll', onScroll, { passive: true })
      update()

      cleanup = () => {
        scroller.removeEventListener('scroll', onScroll)
        if (rafId != null) cancelAnimationFrame(rafId)
        if (hideTimer != null) window.clearTimeout(hideTimer)
      }
    }
    tryAttach()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [methods])

  if (!date) return null
  return (
    <div
      className={`transition-opacity duration-200 ease-out ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}>
      <FeedSeparator variant="day" date={date} floating className="bg-base-100/90 pt-2" />
    </div>
  )
}
