import { hashSource } from '../hashSource'

const PREFIX = 'mermaid-diagram:rendering:'

/** Marks the synchronous draw. A frozen tab leaves the key, so the next load skips that source. */
export const crashMarker = {
  has(source: string): boolean {
    try {
      return sessionStorage.getItem(PREFIX + hashSource(source)) !== null
    } catch {
      return false
    }
  },
  set(source: string): () => void {
    const key = PREFIX + hashSource(source)
    try {
      sessionStorage.setItem(key, '1')
    } catch {
      return () => {}
    }
    return () => {
      try {
        sessionStorage.removeItem(key)
      } catch {
        // Storage is optional; a stale key only skips one source in this tab.
      }
    }
  }
}
