import { useEffect } from 'react'

const EVENT_NAME = 'select:close-others'

/**
 * Page-wide mutual exclusion: every caller joins one group, so opening any
 * `Select` or `SearchableSelect` closes all the others. `id` must be stable
 * and unique per instance (`useId()`) or an instance will close itself.
 */
export function useSelectExclusion(id: string, isOpen: boolean, close: () => void) {
  useEffect(() => {
    if (isOpen) {
      document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { id } }))
    }
  }, [isOpen, id])

  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent<{ id: string }>
      if (detail.id !== id) close()
    }
    document.addEventListener(EVENT_NAME, handler)
    return () => document.removeEventListener(EVENT_NAME, handler)
  }, [id, close])
}
