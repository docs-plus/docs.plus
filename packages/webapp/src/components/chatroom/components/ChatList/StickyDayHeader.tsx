import { useVirtuosoMethods } from '@virtuoso.dev/message-list'
import { format, parseISO } from 'date-fns'
import { useEffect, useState } from 'react'

/**
 * Telegram-style floating date pill. Visible only while the user is
 * actively scrolling; fades out after a short idle window. The first
 * message/day item whose bottom edge is still inside (or below) the
 * scroller's visible top determines the date. Inline `DateChip` rows
 * still render between day groups; this header coexists with them.
 *
 * Implementation notes:
 *  - `scrollerElement()` returns null on first commit (Virtuoso mounts
 *    its imperative handle after the initial render); rAF-poll until it
 *    attaches, mirroring `useChannelMessages.apply`.
 *  - Use `getBoundingClientRect()` not `offsetTop`. Virtuoso positions
 *    each item `absolute`, so `node.offsetTop` is 0 relative to the
 *    per-item wrapper, not the scroller — `offsetTop` comparisons would
 *    silently return the first item regardless of scroll.
 *  - `visible` toggles via opacity (not unmount) so the fade animates
 *    cleanly.
 */
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
      // Seed date silently on mount so the first scroll already has a
      // value to show — without flipping `visible`, so we stay idle-hidden.
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
      className={`pointer-events-none flex w-full justify-center pt-2 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}>
      <div className="badge bg-base-100 shadow-sm">{format(parseISO(date), 'MMMM do, yyyy')}</div>
    </div>
  )
}
