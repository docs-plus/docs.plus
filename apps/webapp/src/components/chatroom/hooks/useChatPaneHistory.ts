import { useChatStore } from '@stores'
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
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      consumePaneStack()
    }
  }, [isOpen])
}
