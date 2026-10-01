import { useChatStore } from '@stores'
import Router from 'next/router'
import { useEffect } from 'react'

type PaneStackState = {
  chatPane?: true
  composerEmojiPanel?: true
  composerLinkDialog?: true
  historyDismiss?: true
}

const isPaneStackMarker = (state: unknown): boolean => {
  if (!state || typeof state !== 'object') return false
  const s = state as PaneStackState
  return !!(s.chatPane || s.composerEmojiPanel || s.composerLinkDialog || s.historyDismiss)
}

const consumePaneStack = (): void => {
  const popNext = () => {
    if (!isPaneStackMarker(window.history.state)) return
    const onPop = () => {
      window.removeEventListener('popstate', onPop)
      popNext()
    }
    window.addEventListener('popstate', onPop)
    window.history.back()
  }
  popNext()
}

/**
 * Own `{ chatPane: true }` entry, not `useHistoryDismiss`. A pop that lands on a
 * stacked overlay marker is not a close; Close consumes those markers first.
 */
export function useChatPaneHistory(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return

    if (!(window.history.state as PaneStackState | null)?.chatPane) {
      window.history.pushState({ chatPane: true } satisfies { chatPane: true }, '')
    }

    const onPopState = () => {
      if (isPaneStackMarker(window.history.state)) return
      useChatStore.getState().destroyChatRoom()
    }

    // A push to another path lands above the marker, and Close cannot pop it from under
    // the new page. Next calls pushState in the same tick as this event, so turn that one
    // call into replaceState: the new page takes the marker's slot. Back then returns to A.
    const onBeforeHistoryChange = (as: string) => {
      if (!isPaneStackMarker(window.history.state)) return
      if (new URL(as, window.location.href).pathname === window.location.pathname) return
      const push = window.history.pushState
      const restore = () => {
        window.history.pushState = push
      }
      window.history.pushState = (...args) => {
        restore()
        window.history.replaceState(...args)
      }
      queueMicrotask(restore)
    }

    window.addEventListener('popstate', onPopState)
    Router.events.on('beforeHistoryChange', onBeforeHistoryChange)
    return () => {
      window.removeEventListener('popstate', onPopState)
      Router.events.off('beforeHistoryChange', onBeforeHistoryChange)
      consumePaneStack()
    }
  }, [isOpen])
}
