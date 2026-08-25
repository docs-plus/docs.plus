import { useStore } from '@stores'
import MobileDetect from 'mobile-detect'
import { useEffect, useRef } from 'react'

type HistoryDismissState = { historyDismiss?: true }

// The store flag is unset outside the document shell, so fall back to the same
// user-agent test the server runs. A narrow window is not the mobile shell.
const isMobileSurface = (): boolean =>
  useStore.getState().settings.editor.isMobile ??
  Boolean(new MobileDetect(window.navigator.userAgent).mobile())

const markerIsLive = (): boolean =>
  !!(window.history.state as HistoryDismissState | null)?.historyDismiss

/** Surfaces holding the one marked entry. A drawer -> sheet handoff passes it along instead of
 *  stacking, so the consume has to know no owner is left before it pops. */
let openSurfaces = 0

/**
 * One marked history entry while any surface is open on mobile, so hardware
 * back closes the surface instead of leaving the document. Same boolean
 * marker as `useSettingsModal`. Pop only while our own marker is on top.
 */
export function useHistoryDismiss(isOpen: boolean, onDismiss: () => void): void {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!isOpen || !isMobileSurface()) return

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
