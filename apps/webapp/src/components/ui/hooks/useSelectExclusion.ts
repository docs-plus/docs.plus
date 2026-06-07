import { useEffect } from 'react'

const EVENT_NAME = 'select:close-others'

/**
 * Ensures only one select/dropdown is open at a time across the entire page.
 *
 * When `isOpen` becomes true, broadcasts a close signal to all other instances.
 * Other instances hearing that signal will call `close()` to dismiss themselves.
 *
 * Works across both `Select` and `SearchableSelect` — any component that calls
 * this hook participates in the same mutual-exclusion group.
 *
 * @param id    – A stable unique identifier for this instance (e.g. from `useId()`)
 * @param isOpen – Whether this instance is currently open
 * @param close  – Callback to close this instance (typically `() => setIsOpen(false)`)
 */
export function useSelectExclusion(id: string, isOpen: boolean, close: () => void) {
  // Broadcast: "I just opened — everyone else close"
  useEffect(() => {
    if (isOpen) {
      document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { id } }))
    }
  }, [isOpen, id])

  // Listen: close myself if someone else opened
  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent<{ id: string }>
      if (detail.id !== id) close()
    }
    document.addEventListener(EVENT_NAME, handler)
    return () => document.removeEventListener(EVENT_NAME, handler)
  }, [id, close])
}
