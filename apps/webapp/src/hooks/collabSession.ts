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
export const IDB_HYDRATION_CAP_MS = 1_000

export interface LocalMirrorHandle {
  whenSynced: Promise<unknown>
  _db: Promise<unknown>
}

/**
 * Waits for the local IndexedDB mirror to hydrate the Y.Doc before the collab
 * provider connects, capped at `capMs` and never blocking when IndexedDB fails.
 */
export function waitForLocalMirror(
  persistence: LocalMirrorHandle | null,
  capMs = IDB_HYDRATION_CAP_MS
): { promise: Promise<void>; cancel: () => void } {
  if (!persistence) {
    return { promise: Promise.resolve(), cancel: () => {} }
  }

  let settled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let resolvePromise: (() => void) | null = null

  const finish = () => {
    if (settled) return
    settled = true
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    resolvePromise?.()
  }

  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
    timer = setTimeout(finish, Math.max(0, capMs))
    void Promise.resolve(persistence.whenSynced).then(finish, finish)
    void Promise.resolve(persistence._db).then(undefined, finish)
  })

  return { promise, cancel: finish }
}

const SELF_HEALING_CLOSE_CODES = new Set([1000, 1001, 1005, 1006, 4408])

export type AuthFailureResolution = 'rearm' | 'error' | 'unauthenticated'

export type CollabIssueKind = 'auth-failed' | 'disconnect' | 'first-sync-timeout'

export interface CollabSessionPorts {
  getStatus?: () => ProviderStatus
  onStatusChange?: (status: ProviderStatus) => void
  isReadOnly?: () => boolean
  hasUnsyncedChanges?: () => boolean
  isOnline?: () => boolean
  isSocketActive?: () => boolean
  onConnect?: () => void
  onDisconnect?: () => void
  hasUnpushedLocalState?: (serverSV: Uint8Array, serverUpdate: Uint8Array) => boolean
  onReportIssue?: (
    kind: CollabIssueKind,
    extra: Record<string, unknown>,
    level?: 'warning' | 'error'
  ) => void
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

export function resolveSettledStatus({
  isReadOnly,
  hasPendingLocalEdits,
  hasUnsyncedChanges,
  fallbackIfPendingFlushed
}: {
  isReadOnly: boolean
  hasPendingLocalEdits: boolean
  hasUnsyncedChanges: boolean
  fallbackIfPendingFlushed: 'saved' | 'synced'
}): { status: 'saved' | 'saving' | 'synced'; keepPendingLocalEdits: boolean } {
  if (isReadOnly || !hasPendingLocalEdits) {
    return { status: 'saved', keepPendingLocalEdits: false }
  }
  if (hasUnsyncedChanges) {
    return { status: 'saving', keepPendingLocalEdits: true }
  }
  return { status: fallbackIfPendingFlushed, keepPendingLocalEdits: false }
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

/**
 * Framework-free collaboration session state machine coordinating provider status,
 * pending local edits, reconnect recovery, auth re-arming, and SyncStep inspection.
 */
export class CollabSession {
  private _status: ProviderStatus = 'saved'
  private isSynced = false
  private hasPendingLocalEdits = false
  private lastUnsyncedCount = 0
  private pendingServerSV: Uint8Array | null = null
  private authStopped = false
  private authRearmCount = 0
  private authFailedSeq = 0
  private tokenState: 'none' | 'anon' | 'session' = 'none'
  private rescopePending = false
  private disposed = false
  private syncedTimer: ReturnType<typeof setTimeout> | null = null
  private authRearmTimer: ReturnType<typeof setTimeout> | null = null
  private errorGraceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly ports: CollabSessionPorts = {}) {}

  get status(): ProviderStatus {
    return this.ports.getStatus ? this.ports.getStatus() : this._status
  }

  get isAuthStopped(): boolean {
    return this.authStopped
  }

  private setStatus(next: ProviderStatus): void {
    this._status = next
    this.ports.onStatusChange?.(next)
  }

  private isReadOnly(): boolean {
    return this.ports.isReadOnly?.() ?? false
  }

  private hasUnsyncedChanges(): boolean {
    return this.ports.hasUnsyncedChanges?.() ?? false
  }

  private isOnline(): boolean {
    if (this.ports.isOnline) return this.ports.isOnline()
    return typeof navigator === 'undefined' ? true : navigator.onLine
  }

  private isSocketActive(): boolean {
    return this.ports.isSocketActive ? this.ports.isSocketActive() : true
  }

  private clearSyncedTimer(): void {
    if (this.syncedTimer) {
      clearTimeout(this.syncedTimer)
      this.syncedTimer = null
    }
  }

  private clearAuthRearmTimer(): void {
    if (this.authRearmTimer) {
      clearTimeout(this.authRearmTimer)
      this.authRearmTimer = null
    }
  }

  private clearErrorGraceTimer(): void {
    if (this.errorGraceTimer) {
      clearTimeout(this.errorGraceTimer)
      this.errorGraceTimer = null
    }
  }

  onTokenResolved(hasSession: boolean): void {
    if (this.disposed) return
    this.tokenState = hasSession ? 'session' : 'anon'
  }

  onSynced(unsyncedCount: number, hasUnsyncedChanges: boolean): void {
    if (this.disposed) return
    this.isSynced = true
    this.rescopePending = false
    this.authStopped = false
    this.authRearmCount = 0
    this.authFailedSeq += 1
    this.clearErrorGraceTimer()
    this.clearSyncedTimer()

    const settled = resolveSettledStatus({
      isReadOnly: this.isReadOnly(),
      hasPendingLocalEdits: this.hasPendingLocalEdits,
      hasUnsyncedChanges,
      fallbackIfPendingFlushed: 'saved'
    })
    this.hasPendingLocalEdits = settled.keepPendingLocalEdits
    this.setStatus(settled.status)
    this.lastUnsyncedCount = unsyncedCount
  }

  onDisconnect(closeCode?: number): void {
    if (this.disposed) return
    this.isSynced = false
    this.tokenState = 'none'
    this.lastUnsyncedCount = 0
    this.pendingServerSV = null
    this.clearSyncedTimer()

    // Reconnect from here, not back-to-back with disconnect(): connect()
    // early-returns while the status is still Connected, which would strand
    // the editor offline. Returning skips the status writes, so this
    // deliberate close cannot arm a false 'error' timer.
    if (this.rescopePending) {
      this.rescopePending = false
      this.ports.onConnect?.()
      return
    }

    if (this.authStopped) return

    if (!this.isOnline()) {
      this.clearErrorGraceTimer()
      this.setStatus('offline')
      return
    }

    if (!closeCode || closeCode === 1000) return

    this.clearErrorGraceTimer()
    if (isSelfHealingCloseCode(closeCode)) {
      this.errorGraceTimer = setTimeout(() => {
        this.errorGraceTimer = null
        if (!this.disposed) this.setStatus('error')
      }, DISCONNECT_ERROR_GRACE_MS)
      return
    }

    this.setStatus('error')
    this.ports.onReportIssue?.('disconnect', { closeCode }, 'warning')
  }

  onUnsyncedChanges(unsyncedCount: number): void {
    if (this.disposed) return
    const previousUnsyncedCount = this.lastUnsyncedCount
    this.lastUnsyncedCount = unsyncedCount
    const currentStatus = this.status

    if (
      unsyncedCount === 0 &&
      this.isSynced &&
      !this.authStopped &&
      !isProviderDisconnected(currentStatus)
    ) {
      this.hasPendingLocalEdits = false
    }

    if (
      !this.isSynced ||
      this.authStopped ||
      this.isReadOnly() ||
      isProviderDisconnected(currentStatus)
    ) {
      this.clearSyncedTimer()
      return
    }

    this.clearSyncedTimer()
    if (unsyncedCount > 0) {
      const grew = unsyncedCount > previousUnsyncedCount
      if (grew) this.hasPendingLocalEdits = true
      if (grew || currentStatus === 'saving') this.setStatus('saving')
      return
    }

    if (currentStatus !== 'saving') return

    this.syncedTimer = setTimeout(() => {
      this.syncedTimer = null
      if (this.disposed) return
      if (
        this.status === 'saving' &&
        this.isSynced &&
        !this.authStopped &&
        !this.isReadOnly() &&
        !this.hasUnsyncedChanges()
      ) {
        this.setStatus('synced')
      }
    }, SYNCED_SETTLE_DELAY_MS)
  }

  onSyncStep(rawData: unknown): void {
    if (this.disposed) return
    try {
      const parsed = parseIncomingSyncStep(rawData)
      if (!parsed) return
      if (parsed.syncType === SYNC_STEP_1) {
        this.pendingServerSV = parsed.payload
        return
      }
      if (!this.pendingServerSV) return
      const serverSV = this.pendingServerSV
      this.pendingServerSV = null
      if (
        !this.isReadOnly() &&
        !this.hasPendingLocalEdits &&
        this.ports.hasUnpushedLocalState?.(serverSV, parsed.payload)
      ) {
        this.hasPendingLocalEdits = true
      }
    } catch {
      this.pendingServerSV = null
    }
  }

  onLocalUpdate(): void {
    if (this.disposed) return
    if (!this.isReadOnly()) {
      this.hasPendingLocalEdits = true
    }
  }

  onDocumentSaved(): void {
    if (this.disposed) return
    const current = this.status
    if (isProviderDisconnected(current) || this.authStopped) return
    if (!this.isReadOnly() && this.hasUnsyncedChanges()) return
    this.hasPendingLocalEdits = false
    this.clearSyncedTimer()
    this.setStatus('saved')
  }

  onReadOnlyLock(): void {
    if (this.disposed || !this.isReadOnly()) return
    this.hasPendingLocalEdits = false
    const current = this.status
    if (current === 'saving' || current === 'synced') {
      this.clearSyncedTimer()
      this.setStatus('saved')
    }
  }

  onOffline(): void {
    if (this.disposed) return
    this.clearSyncedTimer()
    this.clearErrorGraceTimer()
    this.setStatus('offline')
  }

  onReconnect(): void {
    if (this.disposed || this.authStopped) return
    const current = this.status
    if (this.isSynced && (current === 'offline' || current === 'error')) {
      const settled = resolveSettledStatus({
        isReadOnly: this.isReadOnly(),
        hasPendingLocalEdits: this.hasPendingLocalEdits,
        hasUnsyncedChanges: this.hasUnsyncedChanges(),
        fallbackIfPendingFlushed: 'synced'
      })
      this.hasPendingLocalEdits = settled.keepPendingLocalEdits
      this.setStatus(settled.status)
    }
    this.ports.onConnect?.()
  }

  async onAuthFailed(reason: string, getHasSession: () => Promise<boolean>): Promise<void> {
    if (this.disposed) return
    const seq = ++this.authFailedSeq
    this.authStopped = true
    this.pendingServerSV = null
    this.clearSyncedTimer()
    this.clearErrorGraceTimer()
    this.ports.onDisconnect?.()

    const hasSession = await getHasSession()
    if (this.disposed || seq !== this.authFailedSeq) return

    const resolution = resolveAuthFailure({
      hasSession,
      rearmCount: this.authRearmCount
    })

    if (resolution === 'rearm') {
      this.authRearmCount += 1
      this.clearAuthRearmTimer()
      this.authRearmTimer = setTimeout(() => {
        this.authRearmTimer = null
        if (!this.disposed) this.ports.onConnect?.()
      }, AUTH_REARM_DELAY_MS)
      return
    }

    this.setStatus(resolution === 'unauthenticated' ? 'unauthenticated' : 'error')
    this.ports.onReportIssue?.('auth-failed', { reason })
  }

  onAuthEvent(event: string): void {
    if (this.disposed) return
    if (event !== 'TOKEN_REFRESHED' && event !== 'SIGNED_IN') return

    if (this.authStopped) {
      this.authFailedSeq += 1
      this.authStopped = false
      this.authRearmCount = 0
      this.clearAuthRearmTimer()
      this.ports.onConnect?.()
      return
    }

    // A healthy socket opened anonymously must reopen to pick up the new scope.
    if (event === 'SIGNED_IN' && this.tokenState === 'anon' && this.isSocketActive()) {
      this.rescopePending = true
      this.ports.onDisconnect?.()
    }
  }

  onFirstSyncTimeout(): void {
    if (this.disposed || this.isSynced) return
    const current = this.status
    if (current === 'offline' || current === 'unauthenticated') return
    this.clearErrorGraceTimer()
    this.setStatus('error')
    this.ports.onReportIssue?.('first-sync-timeout', { timeoutMs: FIRST_SYNC_TIMEOUT_MS })
  }

  stopReconnect(): void {
    this.authStopped = true
    this.clearAuthRearmTimer()
  }

  dispose(): void {
    this.disposed = true
    this.authFailedSeq += 1
    this.clearSyncedTimer()
    this.clearAuthRearmTimer()
    this.clearErrorGraceTimer()
    this.isSynced = false
    this.hasPendingLocalEdits = false
    this.lastUnsyncedCount = 0
    this.pendingServerSV = null
    this.authStopped = false
    this.authRearmCount = 0
    this.tokenState = 'none'
    this.rescopePending = false
  }
}
