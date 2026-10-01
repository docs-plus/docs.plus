type Flush = () => Promise<unknown> | undefined

let pendingFlush: Flush | null = null

/** The open Notifications section registers its debounced save; returns the unregister. */
export const registerPendingPreferenceFlush = (flush: Flush) => {
  pendingFlush = flush
  return () => {
    if (pendingFlush === flush) pendingFlush = null
  }
}

/** Sign-out awaits this first: after `signOut()` the RPC refuses the write (42501). */
export const flushPendingPreferenceWrites = async () => {
  await pendingFlush?.()
}
