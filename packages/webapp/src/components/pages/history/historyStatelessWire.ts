/**
 * Hocuspocus stateless convention (this app):
 * - Client → server: `{ msg: 'history', type, documentId? }` (server uses the WebSocket room id; optional `documentId` must match or → `history_failed`)
 * - Server → client: `{ msg: 'history.response', type, response }` on the **same connection** (unicast).
 * - Failures: `{ msg: 'history.response', type, response: null, error: 'history_failed' }`
 *
 * `history.list` response shape (current server): `{ versions: HistoryItemMeta[], latestSnapshot: HistorySnapshot | null }`
 * Legacy servers may return `HistoryItem[]` only — client accepts both.
 */

export const HISTORY_CLIENT_MSG = 'history' as const
export const HISTORY_RESPONSE = 'history.response' as const
export const HISTORY_ERROR = 'history_failed' as const

export type HistoryStatelessSender = {
  sendStateless: (payload: string) => void
}

export function sendHistoryListRequest(
  sender: HistoryStatelessSender,
  documentId: string | undefined
): void {
  sender.sendStateless(
    JSON.stringify({
      msg: HISTORY_CLIENT_MSG,
      type: 'history.list',
      documentId
    })
  )
}

export function sendHistoryWatchRequest(
  sender: HistoryStatelessSender,
  version: number,
  documentId: string | undefined
): void {
  sender.sendStateless(
    JSON.stringify({
      msg: HISTORY_CLIENT_MSG,
      type: 'history.watch',
      version,
      documentId
    })
  )
}
