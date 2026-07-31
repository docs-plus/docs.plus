/**
 * Hocuspocus stateless: client `{ msg: 'history', type, documentId? }`;
 * server unicast `{ msg: 'history.response', type, response }` on the same connection.
 * Failures use `error: 'history_failed'`. List may include `latestSnapshot` (legacy: plain array).
 */
import type {
  ClientAuthorBinding,
  HistoryItem,
  HistoryProfileMap,
  VersionFailureReason
} from '@types'

export const HISTORY_CLIENT_MSG = 'history' as const
export const HISTORY_RESPONSE = 'history.response' as const
export const HISTORY_ERROR = 'history_failed' as const
/** Worker broadcast after a version row lands: `{ msg, documentId, version, timestamp }`. */
export const HISTORY_SAVED_MSG = 'document:saved' as const

export type HistoryListWireResponse =
  | HistoryItem[]
  | {
      versions: HistoryItem[]
      latestSnapshot: HistoryItem | null
      profiles?: HistoryProfileMap
      clientAuthors?: ClientAuthorBinding[]
    }

export type HistoryRevertWireResponse = {
  restoredFrom: number
  backupVersion: number
}

export type HistoryStatelessPayload = {
  msg?: string
  type?: 'history.list' | 'history.watch' | 'history.revert'
  response?: HistoryListWireResponse | HistoryItem | HistoryRevertWireResponse | null
  error?: typeof HISTORY_ERROR
  /** Present on the version ops; legacy list/watch failures carry the bare error only. */
  reason?: VersionFailureReason
  /** `document:saved` broadcast only — a different message on the same parse. */
  documentId?: string
  version?: number
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

export function sendHistoryRevertRequest(
  sender: HistoryStatelessSender,
  version: number,
  documentId: string | undefined
): void {
  sender.sendStateless(
    JSON.stringify({
      msg: HISTORY_CLIENT_MSG,
      type: 'history.revert',
      version,
      documentId
    })
  )
}
