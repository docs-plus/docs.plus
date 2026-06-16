export interface HistoryItem {
  version: number
  createdAt: string
  commitMessage?: string
  /** Base64 Yjs update from `history.watch` / `latestSnapshot`. */
  data?: string
}
