import type { ProviderStatus } from '@types'
import { type DocumentOwnerFields, isDocumentOwner } from '@utils/isDocumentOwner'
import { isProviderDisconnected } from '@utils/providerCollabStatus'
import * as Y from 'yjs'

const MESSAGE_TYPE_SYNC = 0
const SYNC_STEP_1 = 0
const SYNC_STEP_2 = 1

export const FIRST_SYNC_TIMEOUT_MS = 15_000
export const MAX_AUTH_REARM = 5
export const AUTH_REARM_DELAY_MS = 3_000
export const DISCONNECT_ERROR_GRACE_MS = 3_000
export const SYNCED_SETTLE_DELAY_MS = 300

const SELF_HEALING_CLOSE_CODES = new Set([1000, 1001, 1005, 1006, 4408])

export type AuthFailureResolution = 'rearm' | 'error' | 'unauthenticated'

export type UnsyncedChangesAction =
  { type: 'ignore' } | { type: 'saving' } | { type: 'schedule-synced' }

export function resolveUnsyncedChangesAction({
  unsyncedCount,
  previousUnsyncedCount,
  isSynced,
  authStopped,
  isReadOnly,
  currentStatus
}: {
  unsyncedCount: number
  previousUnsyncedCount: number
  isSynced: boolean
  authStopped: boolean
  isReadOnly: boolean
  currentStatus: ProviderStatus
}): UnsyncedChangesAction {
  if (!isSynced || authStopped || isReadOnly || isProviderDisconnected(currentStatus)) {
    return { type: 'ignore' }
  }
  if (unsyncedCount > 0) {
    if (currentStatus === 'saving' || unsyncedCount > previousUnsyncedCount) {
      return { type: 'saving' }
    }
    return { type: 'ignore' }
  }
  return currentStatus === 'saving' ? { type: 'schedule-synced' } : { type: 'ignore' }
}

export function isSelfHealingCloseCode(code: number): boolean {
  return SELF_HEALING_CLOSE_CODES.has(code)
}

export function resolveAuthFailure({
  hasSession,
  rearmCount,
  maxRearm = MAX_AUTH_REARM
}: {
  hasSession: boolean
  rearmCount: number
  maxRearm?: number
}): AuthFailureResolution {
  if (hasSession && rearmCount < maxRearm) return 'rearm'
  return hasSession ? 'error' : 'unauthenticated'
}

export function authFailureToProviderStatus(
  resolution: Exclude<AuthFailureResolution, 'rearm'>
): ProviderStatus {
  return resolution === 'unauthenticated' ? 'unauthenticated' : 'error'
}

export function shouldRestoreSavedOnReconnect(isSynced: boolean, current: ProviderStatus): boolean {
  return isSynced && (current === 'offline' || current === 'error')
}

export function shouldFireFirstSyncTimeout(isSynced: boolean, current: ProviderStatus): boolean {
  return !isSynced && current !== 'offline' && current !== 'unauthenticated'
}

export function isDocumentAccessReadOnly(
  settings: {
    authorizedScope?: string | null
    metadata?: (DocumentOwnerFields & { readOnly?: boolean | null }) | null
  },
  profileId?: string | null
): boolean {
  if (settings.authorizedScope === 'readonly') return true

  const metadata = settings.metadata
  return (
    metadata?.readOnly === true && metadata.ownerId != null && !isDocumentOwner(metadata, profileId)
  )
}

function isArrayBuffer(raw: unknown): raw is ArrayBuffer {
  return (
    raw instanceof ArrayBuffer || Object.prototype.toString.call(raw) === '[object ArrayBuffer]'
  )
}

function readVarUint(bytes: Uint8Array, state: { pos: number }): number {
  let num = 0
  let mult = 1
  while (state.pos < bytes.length) {
    const byte = bytes[state.pos++]
    num += (byte & 0x7f) * mult
    if (byte < 0x80) return num
    if (mult > 2 ** 45) return -1
    mult *= 128
  }
  return -1
}

export function parseIncomingSyncStep(
  raw: unknown
): { syncType: typeof SYNC_STEP_1 | typeof SYNC_STEP_2; payload: Uint8Array } | null {
  const bytes =
    raw instanceof Uint8Array
      ? raw
      : isArrayBuffer(raw)
        ? new Uint8Array(raw)
        : ArrayBuffer.isView(raw)
          ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
          : null
  if (!bytes) return null

  const state = { pos: 0 }
  const nameLen = readVarUint(bytes, state)
  if (nameLen < 0 || state.pos + nameLen > bytes.length) return null
  state.pos += nameLen

  if (readVarUint(bytes, state) !== MESSAGE_TYPE_SYNC) return null
  const syncType = readVarUint(bytes, state)
  if (syncType !== SYNC_STEP_1 && syncType !== SYNC_STEP_2) return null

  const payloadLen = readVarUint(bytes, state)
  if (payloadLen < 0 || state.pos + payloadLen > bytes.length) return null
  return { syncType, payload: bytes.subarray(state.pos, state.pos + payloadLen) }
}

export function hasUnpushedLocalState(
  doc: Y.Doc,
  serverSVBytes: Uint8Array,
  serverUpdateBytes: Uint8Array
): boolean {
  const snap = Y.snapshot(doc)
  const serverSV = Y.decodeStateVector(serverSVBytes)
  for (const [client, clock] of snap.sv) {
    if ((serverSV.get(client) ?? 0) < clock) return true
  }
  if (snap.ds.clients.size === 0) return false
  const { ds: serverDS } = Y.decodeUpdate(serverUpdateBytes)
  return !Y.equalDeleteSets(Y.mergeDeleteSets([snap.ds, serverDS]), serverDS)
}
