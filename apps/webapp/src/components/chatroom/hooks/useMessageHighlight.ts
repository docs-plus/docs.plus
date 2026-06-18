import {
  highlightClearGate,
  MESSAGE_HIGHLIGHT_MS
} from '@components/chatroom/utils/messageJumpTiming'
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let current: string | null = null

function publishHighlight(id: string | null) {
  current = id
  listeners.forEach((l) => l())
}

function subscribeHighlight(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

export function flashMessage(id: string): void {
  highlightClearGate.invalidate()
  publishHighlight(null)
  requestAnimationFrame(() => {
    publishHighlight(id)
    highlightClearGate.runAfter(MESSAGE_HIGHLIGHT_MS, () => publishHighlight(null))
  })
}

export function useIsMessageHighlighted(messageId: string): boolean {
  return useSyncExternalStore(
    subscribeHighlight,
    () => current === messageId,
    () => false
  )
}
