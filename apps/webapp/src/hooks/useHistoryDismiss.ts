import { useEffect, useRef } from 'react'

const DISMISS_MQ = '(max-width: 767px)'

type HistoryDismissState = { historyDismiss?: true }

const markerIsLive = (): boolean =>
  !!(window.history.state as HistoryDismissState | null)?.historyDismiss

/** Surfaces holding the one marked entry. A drawer -> sheet handoff passes it along instead of
 *  stacking, so the consume has to know no owner is left before it pops. */
let openSurfaces = 0

/**
 * One marked history entry while any surface is open below `md`, so hardware back closes the
 * surface instead of leaving the document. X / scrim / drag flip `isOpen` and consume it here.
 * Boolean marker, same protocol as `useSettingsModal` and the composer emoji/link stores. Pop
 * only while our own marker is on top, so another surface's entry can never be popped by us.
 */
export function useHistoryDismiss(isOpen: boolean, onDismiss: () => void): void {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!isOpen || !window.matchMedia(DISMISS_MQ).matches) return

    openSurfaces += 1
    if (!markerIsLive())
      window.history.pushState({ historyDismiss: true } as HistoryDismissState, '')

    const onPopState = () => {
      // Landing back on the marker means a surface stacked above us was popped, not us.
      if (markerIsLive()) return
      onDismissRef.current()
    }
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      openSurfaces -= 1
      // Deferred: React runs every cleanup before any effect. A sibling opening in this
      // same flush (TOC drawer -> filter sheet) has not adopted the entry yet.
      queueMicrotask(() => {
        if (openSurfaces === 0 && markerIsLive()) window.history.back()
      })
    }
  }, [isOpen])
}
