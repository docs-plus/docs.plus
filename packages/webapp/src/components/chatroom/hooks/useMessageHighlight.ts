import { useCallback, useEffect, useState } from 'react'

/**
 * Module-scoped pub/sub so every MessageCard reads the same highlight
 * state without prop drilling. Resets to null after the flash window.
 */
const HIGHLIGHT_MS = 1500
const listeners = new Set<(id: string | null) => void>()
let current: string | null = null

export const useMessageHighlight = () => {
  const [highlightedId, setHighlightedId] = useState<string | null>(current)
  useEffect(() => {
    listeners.add(setHighlightedId)
    return () => {
      listeners.delete(setHighlightedId)
    }
  }, [])
  const flash = useCallback((id: string) => {
    current = id
    listeners.forEach((l) => l(id))
    window.setTimeout(() => {
      current = null
      listeners.forEach((l) => l(null))
    }, HIGHLIGHT_MS)
  }, [])
  return { highlightedId, flash }
}
