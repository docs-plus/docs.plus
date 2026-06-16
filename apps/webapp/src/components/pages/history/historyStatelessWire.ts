/**
 * Hocuspocus stateless: client `{ msg: 'history', type, documentId? }`;
 * server unicast `{ msg: 'history.response', type, response }` on the same connection.
 * Failures use `error: 'history_failed'`. List may include `latestSnapshot` (legacy: plain array).
 */
import type { HistoryItem } from '@types'

export const HISTORY_CLIENT_MSG = 'history' as const
export const HISTORY_RESPONSE = 'history.response' as const
export const HISTORY_ERROR = 'history_failed' as const

export type HistoryListWireResponse =
  | HistoryItem[]
  | { versions: HistoryItem[]; latestSnapshot: HistoryItem | null }

export type HistoryStatelessPayload = {
  msg?: string
  type?: 'history.list' | 'history.watch'
  response?: HistoryListWireResponse | HistoryItem | null
  error?: typeof HISTORY_ERROR
}

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
