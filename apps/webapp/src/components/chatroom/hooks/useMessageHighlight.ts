import {
  highlightClearGate,
  MESSAGE_HIGHLIGHT_MS
} from '@components/chatroom/utils/messageJumpTiming'
import { useCallback, useEffect, useState } from 'react'

const listeners = new Set<(id: string | null) => void>()
let current: string | null = null

function publishHighlight(id: string | null) {
  current = id
  listeners.forEach((l) => l(id))
}

export const useMessageHighlight = () => {
  const [highlightedId, setHighlightedId] = useState<string | null>(current)
  useEffect(() => {
    listeners.add(setHighlightedId)
    return () => {
      listeners.delete(setHighlightedId)
    }
  }, [])

  const flash = useCallback((id: string) => {
    publishHighlight(id)
    highlightClearGate.runAfter(MESSAGE_HIGHLIGHT_MS, () => publishHighlight(null))
  }, [])

  return { highlightedId, flash }
}
