export type HistoryDismissState = { historyDismiss?: true }

export const historyDismissMarkerIsLive = (): boolean =>
  !!(window.history.state as HistoryDismissState | null)?.historyDismiss

let pendingPop: Promise<void> | null = null

/**
 * Pops the marked entry once and resolves when the traversal lands. A caller that writes the
 * URL next awaits this, so the close's pop cannot land on top of its write. `history.state`
 * only changes on landing, so every pop shares the one in-flight promise.
 */
export function consumeHistoryDismissEntry(): Promise<void> {
  if (pendingPop) return pendingPop
  if (!historyDismissMarkerIsLive()) return Promise.resolve()
  pendingPop = new Promise((resolve) => {
    const onLanded = () => {
      pendingPop = null
      resolve()
    }
    window.addEventListener('popstate', onLanded, { once: true })
    window.history.back()
  })
  return pendingPop
}

/**
 * Resolves once a pop that a closing surface started has landed. The close queues its pop in
 * a microtask, so read it one turn later. A push before the landing is taken by that pop:
 * Safari lands it about 90 ms after the tap (#639).
 */
export function whenHistoryDismissSettles(): Promise<void> {
  return Promise.resolve().then(() => pendingPop ?? undefined)
}
