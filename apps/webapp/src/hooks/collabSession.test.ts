import { runInNewContext } from 'node:vm'

import type { ProviderStatus } from '@types'
import * as Y from 'yjs'

import {
  AUTH_REARM_DELAY_MS,
  CollabSession,
  DISCONNECT_ERROR_GRACE_MS,
  FIRST_SYNC_TIMEOUT_MS,
  hasUnpushedLocalState,
  IDB_HYDRATION_CAP_MS,
  isDocumentAccessReadOnly,
  isSelfHealingCloseCode,
  MAX_AUTH_REARM,
  parseIncomingSyncStep,
  resolveAuthFailure,
  resolveSettledStatus,
  SYNCED_SETTLE_DELAY_MS,
  waitForLocalMirror
} from './collabSession'

function writeVarUint(out: number[], value: number): void {
  let num = value
  while (num >= 0x80) {
    out.push(0x80 | (num & 0x7f))
    num = Math.floor(num / 128)
  }
  out.push(num & 0x7f)
}

function encodeSyncFrame(
  docName: string,
  messageType: number,
  syncType: number,
  payload: Uint8Array
): Uint8Array {
  const out: number[] = []
  const nameBytes = Buffer.from(docName, 'utf8')
  writeVarUint(out, nameBytes.length)
  out.push(...nameBytes)
  writeVarUint(out, messageType)
  writeVarUint(out, syncType)
  writeVarUint(out, payload.length)
  out.push(...payload)
  return new Uint8Array(out)
}

describe('collabSession pure helpers', () => {
  it('unifies settled status resolution for onSynced and reconnect', () => {
    expect(
      resolveSettledStatus({
        isReadOnly: false,
        hasPendingLocalEdits: true,
        hasUnsyncedChanges: true,
        fallbackIfPendingFlushed: 'saved'
      })
    ).toEqual({ status: 'saving', keepPendingLocalEdits: true })

    expect(
      resolveSettledStatus({
        isReadOnly: false,
        hasPendingLocalEdits: true,
        hasUnsyncedChanges: false,
        fallbackIfPendingFlushed: 'saved'
      })
    ).toEqual({ status: 'saved', keepPendingLocalEdits: false })

    expect(
      resolveSettledStatus({
        isReadOnly: false,
        hasPendingLocalEdits: true,
        hasUnsyncedChanges: false,
        fallbackIfPendingFlushed: 'synced'
      })
    ).toEqual({ status: 'synced', keepPendingLocalEdits: false })

    expect(
      resolveSettledStatus({
        isReadOnly: true,
        hasPendingLocalEdits: true,
        hasUnsyncedChanges: true,
        fallbackIfPendingFlushed: 'synced'
      })
    ).toEqual({ status: 'saved', keepPendingLocalEdits: false })
  })

  it('classifies self-healing close codes and bounded auth failure recovery', () => {
    expect(isSelfHealingCloseCode(1006)).toBe(true)
    expect(isSelfHealingCloseCode(4408)).toBe(true)
    expect(isSelfHealingCloseCode(4403)).toBe(false)

    expect(resolveAuthFailure({ hasSession: true, rearmCount: 0 })).toBe('rearm')
    expect(resolveAuthFailure({ hasSession: true, rearmCount: MAX_AUTH_REARM })).toBe('error')
    expect(resolveAuthFailure({ hasSession: false, rearmCount: 0 })).toBe('unauthenticated')
  })

  it('detects readonly scope and non-owner metadata readOnly without locking on unrelated fields', () => {
    expect(
      isDocumentAccessReadOnly({
        authorizedScope: 'readonly',
        metadata: { documentId: 'doc-1', readOnly: false, ownerId: 'owner-1' }
      })
    ).toBe(true)

    expect(
      isDocumentAccessReadOnly(
        {
          authorizedScope: 'read-write',
          metadata: { documentId: 'doc-1', readOnly: true, ownerId: 'owner-1' }
        },
        'user-1'
      )
    ).toBe(true)

    expect(
      isDocumentAccessReadOnly(
        {
          authorizedScope: 'read-write',
          metadata: { documentId: 'doc-1', readOnly: true, ownerId: 'owner-1' }
        },
        'owner-1'
      )
    ).toBe(false)

    expect(
      isDocumentAccessReadOnly(
        {
          authorizedScope: 'read-write',
          metadata: { documentId: 'doc-1', readOnly: true, ownerId: null }
        },
        'user-1'
      )
    ).toBe(false)

    const withErrorStatus: {
      authorizedScope: string
      metadata: { documentId: string; readOnly: boolean; ownerId: string }
      providerStatus: ProviderStatus
    } = {
      authorizedScope: 'read-write',
      metadata: { documentId: 'doc-1', readOnly: false, ownerId: 'owner-1' },
      providerStatus: 'error'
    }
    expect(isDocumentAccessReadOnly(withErrorStatus, 'user-1')).toBe(false)
  })
})

describe('parseIncomingSyncStep', () => {
  it('parses SyncStep1 and SyncStep2 payloads from Uint8Array, ArrayBuffer, and ArrayBufferView', () => {
    const step1Payload = new Uint8Array([1, 2, 3])
    const step1Bytes = encodeSyncFrame('doc-123', 0, 0, step1Payload)
    expect(parseIncomingSyncStep(step1Bytes)).toEqual({
      syncType: 0,
      payload: step1Payload
    })

    const step2Payload = new Uint8Array([4, 5, 6, 7])
    const step2Bytes = encodeSyncFrame('doc-123', 0, 1, step2Payload)
    const ab = step2Bytes.buffer.slice(
      step2Bytes.byteOffset,
      step2Bytes.byteOffset + step2Bytes.byteLength
    )
    expect(parseIncomingSyncStep(ab)).toEqual({
      syncType: 1,
      payload: step2Payload
    })

    const padded = new Uint8Array(step1Bytes.length + 4)
    padded.set(step1Bytes, 2)
    const view = new DataView(padded.buffer, 2, step1Bytes.length)
    expect(parseIncomingSyncStep(view)).toEqual({
      syncType: 0,
      payload: step1Payload
    })
  })

  it('returns null for non-sync frames, Sync/Update, malformed lengths, and non-binary inputs', () => {
    const syncUpdate = encodeSyncFrame('doc-123', 0, 2, new Uint8Array([1, 2]))
    const stateless = encodeSyncFrame('doc-123', 5, 0, new Uint8Array([1, 2]))
    const full = encodeSyncFrame('doc-123', 0, 0, new Uint8Array([1, 2, 3]))
    const truncatedPayload = full.subarray(0, full.length - 1)
    const truncatedName = new Uint8Array([10, 97, 98])
    const unterminatedVarUint = new Uint8Array([0x80, 0x80])

    expect(parseIncomingSyncStep(syncUpdate)).toBeNull()
    expect(parseIncomingSyncStep(stateless)).toBeNull()
    expect(parseIncomingSyncStep(truncatedPayload)).toBeNull()
    expect(parseIncomingSyncStep(truncatedName)).toBeNull()
    expect(parseIncomingSyncStep(unterminatedVarUint)).toBeNull()
    expect(parseIncomingSyncStep('not-binary')).toBeNull()
    expect(parseIncomingSyncStep(null)).toBeNull()
  })

  it('decodes cross-realm ArrayBuffer and Uint8Array frames', () => {
    const step2Payload = new Uint8Array([9, 8, 7])
    const step2Bytes = encodeSyncFrame('doc-cross', 0, 1, step2Payload)
    const crossRealmBuffer = runInNewContext('new Uint8Array(bytes).buffer', {
      bytes: Array.from(step2Bytes)
    }) as ArrayBuffer
    const crossRealmView = runInNewContext('new Uint8Array(bytes)', {
      bytes: Array.from(step2Bytes)
    }) as Uint8Array

    expect(crossRealmBuffer instanceof ArrayBuffer).toBe(false)
    expect(crossRealmView instanceof Uint8Array).toBe(false)
    expect(parseIncomingSyncStep(crossRealmBuffer)).toEqual({
      syncType: 1,
      payload: step2Payload
    })
    expect(parseIncomingSyncStep(crossRealmView)).toEqual({
      syncType: 1,
      payload: step2Payload
    })
  })
})

describe('hasUnpushedLocalState', () => {
  it('returns false for an empty doc against empty or non-empty server state', () => {
    const localDoc = new Y.Doc()
    const serverDoc = new Y.Doc()

    expect(
      hasUnpushedLocalState(
        localDoc,
        Y.encodeStateVector(serverDoc),
        Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(localDoc))
      )
    ).toBe(false)

    serverDoc.getText('t').insert(0, 'server content')
    expect(
      hasUnpushedLocalState(
        localDoc,
        Y.encodeStateVector(serverDoc),
        Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(localDoc))
      )
    ).toBe(false)
  })

  it('returns false when local IDB state matches or is stale behind server inserts and deletes', () => {
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'hello world')
    serverDoc.getText('t').delete(5, 6)

    const localDoc = new Y.Doc()
    Y.applyUpdate(localDoc, Y.encodeStateAsUpdate(serverDoc))

    expect(
      hasUnpushedLocalState(
        localDoc,
        Y.encodeStateVector(serverDoc),
        Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(localDoc))
      )
    ).toBe(false)

    serverDoc.getText('t').insert(5, ' server-tail')
    serverDoc.getText('t').delete(0, 3)

    expect(
      hasUnpushedLocalState(
        localDoc,
        Y.encodeStateVector(serverDoc),
        Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(localDoc))
      )
    ).toBe(false)
  })

  it('returns true when local IDB state contains unpushed inserts or delete-only mutations', () => {
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'keep delete-me')

    const insertDoc = new Y.Doc()
    Y.applyUpdate(insertDoc, Y.encodeStateAsUpdate(serverDoc))
    insertDoc.getText('t').insert(14, ' offline-insert')
    serverDoc.getText('t').insert(0, 'concurrent ')

    expect(
      hasUnpushedLocalState(
        insertDoc,
        Y.encodeStateVector(serverDoc),
        Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(insertDoc))
      )
    ).toBe(true)

    const deleteDoc = new Y.Doc()
    Y.applyUpdate(deleteDoc, Y.encodeStateAsUpdate(serverDoc))
    deleteDoc.getText('t').delete(4, 10)

    expect(
      hasUnpushedLocalState(
        deleteDoc,
        Y.encodeStateVector(serverDoc),
        Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(deleteDoc))
      )
    ).toBe(true)
  })
})

function createTestSession(opts?: {
  doc?: Y.Doc
  readOnly?: boolean
  online?: boolean
  onConnect?: jest.Mock
  onDisconnect?: jest.Mock
  onReportIssue?: jest.Mock
}) {
  const doc = opts?.doc ?? new Y.Doc()
  let unsyncedCount = 0
  let readOnly = opts?.readOnly ?? false
  let online = opts?.online ?? true
  const onConnect = opts?.onConnect ?? jest.fn()
  const onDisconnect = opts?.onDisconnect ?? jest.fn()
  const onReportIssue = opts?.onReportIssue ?? jest.fn()

  const session = new CollabSession({
    isReadOnly: () => readOnly,
    hasUnsyncedChanges: () => unsyncedCount > 0,
    isOnline: () => online,
    onConnect,
    onDisconnect,
    hasUnpushedLocalState: (sv, update) => hasUnpushedLocalState(doc, sv, update),
    onReportIssue
  })

  return {
    doc,
    session,
    onConnect,
    onDisconnect,
    onReportIssue,
    setReadOnly: (next: boolean) => {
      readOnly = next
    },
    setOnline: (next: boolean) => {
      online = next
    },
    startSync: () => {
      unsyncedCount = 1
      session.onUnsyncedChanges(unsyncedCount)
    },
    emitUnsynced: (count: number) => {
      unsyncedCount = count
      session.onUnsyncedChanges(count)
    },
    emitSynced: () => {
      session.onSynced(unsyncedCount, unsyncedCount > 0)
    },
    emitSyncAck: () => {
      if (unsyncedCount > 0) unsyncedCount -= 1
      session.onUnsyncedChanges(unsyncedCount)
    }
  }
}

describe('CollabSession state machine', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sets saving immediately when unsyncedChanges > 0 and settles to synced after 300ms at 0', () => {
    const h = createTestSession()
    h.startSync()
    h.emitSynced()
    expect(h.session.status).toBe('saved')

    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('saved')

    h.session.onLocalUpdate()
    h.emitUnsynced(1)
    expect(h.session.status).toBe('saving')

    h.emitUnsynced(0)
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS - 1)
    expect(h.session.status).toBe('saving')

    jest.advanceTimersByTime(1)
    expect(h.session.status).toBe('synced')

    // Rising again mid-settle cancels the pending synced transition.
    h.emitUnsynced(1)
    h.emitUnsynced(0)
    jest.advanceTimersByTime(150)
    h.emitUnsynced(1)
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('saving')

    h.emitUnsynced(0)
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('synced')
    h.session.dispose()
  })

  it('ignores startSync and clean pre-sync 2 -> 1 -> 0 drains while capturing real post-sync edits', () => {
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'saved content')
    const h = createTestSession()

    h.startSync()
    Y.applyUpdate(h.doc, Y.encodeStateAsUpdate(serverDoc))
    h.emitUnsynced(2)
    h.session.onSyncStep(encodeSyncFrame('doc-1', 0, 0, Y.encodeStateVector(serverDoc)))
    h.session.onSyncStep(
      encodeSyncFrame('doc-1', 0, 1, Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(h.doc)))
    )
    h.emitSynced()
    expect(h.session.status).toBe('saved')

    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('saved')

    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('saved')

    // Case A: Real local edit arrives while unsyncedChanges === 2 (2 -> 3).
    h.session.onDisconnect(1006)
    h.startSync()
    h.emitUnsynced(2)
    h.emitSynced()
    expect(h.session.status).toBe('saved')

    h.session.onLocalUpdate()
    h.emitUnsynced(3)
    expect(h.session.status).toBe('saving')

    h.emitSyncAck()
    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('saving')

    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('synced')

    // Case B: First ack drains 2 -> 1 (stays saved), then real edit rises 1 -> 2.
    h.session.onDisconnect(1006)
    h.startSync()
    h.emitUnsynced(2)
    h.emitSynced()
    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('saved')

    h.session.onLocalUpdate()
    h.emitUnsynced(2)
    expect(h.session.status).toBe('saving')
    h.emitSyncAck()
    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('synced')
    h.session.dispose()
  })

  it('holds saving on offline-to-online reconnect until SyncStatus drops unsyncedChanges to 0', () => {
    const h = createTestSession()
    h.startSync()
    h.emitSynced()
    h.emitSyncAck()

    h.setOnline(false)
    h.session.onOffline()
    h.session.onLocalUpdate()
    h.emitUnsynced(3)
    expect(h.session.status).toBe('offline')

    // Online before socket closed must hold saving, not jump to saved.
    h.setOnline(true)
    h.session.onReconnect()
    expect(h.session.status).toBe('saving')

    // Full disconnect + reconnect cycle holds saving until acks drain.
    h.session.onDisconnect(1006)
    h.setOnline(false)
    h.session.onOffline()
    h.session.onLocalUpdate()
    expect(h.session.status).toBe('offline')

    h.setOnline(true)
    h.startSync()
    h.emitSynced()
    expect(h.session.status).toBe('saving')

    h.emitSyncAck()
    h.emitSyncAck()
    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS - 1)
    expect(h.session.status).toBe('saving')
    jest.advanceTimersByTime(1)
    expect(h.session.status).toBe('synced')
    h.session.dispose()
  })

  it('holds saving across 1-RTT edits, brief disconnects, 1006 grace expiry, and first-sync timeout with dirty IDB state', () => {
    // 1-RTT window: local edit before initial SyncStatus(true) arrives.
    const h1 = createTestSession()
    h1.startSync()
    h1.emitSynced()
    h1.session.onLocalUpdate()
    h1.emitUnsynced(2)
    expect(h1.session.status).toBe('saving')
    h1.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h1.session.status).toBe('saving')
    h1.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h1.session.status).toBe('synced')

    // Brief disconnect during 300ms settle window (0 unsynced) restores saved.
    h1.session.onLocalUpdate()
    h1.emitUnsynced(1)
    h1.emitSyncAck()
    expect(h1.session.status).toBe('saving')
    h1.session.onDisconnect(1006)
    h1.startSync()
    h1.emitSynced()
    expect(h1.session.status).toBe('saved')

    // 1006 grace expiry to error with pending local edits holds saving on reconnect.
    h1.session.onDisconnect(1006)
    jest.advanceTimersByTime(1000)
    h1.session.onLocalUpdate()
    h1.emitUnsynced(1)
    expect(h1.session.status).toBe('saved')
    jest.advanceTimersByTime(DISCONNECT_ERROR_GRACE_MS - 1000)
    expect(h1.session.status).toBe('error')

    h1.startSync()
    h1.emitSynced()
    expect(h1.session.status).toBe('saving')
    h1.emitSyncAck()
    h1.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h1.session.status).toBe('synced')
    h1.session.dispose()

    // First-sync timeout sets error before slow SyncStep1/SyncStep2 detects dirty IDB state.
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'server')
    const dirtyDoc = new Y.Doc()
    Y.applyUpdate(dirtyDoc, Y.encodeStateAsUpdate(serverDoc))
    dirtyDoc.getText('t').insert(6, ' offline-idb')

    const h2 = createTestSession()
    Y.applyUpdate(h2.doc, Y.encodeStateAsUpdate(dirtyDoc))
    h2.session.onFirstSyncTimeout()
    expect(h2.session.status).toBe('error')
    expect(h2.onReportIssue).toHaveBeenCalledWith('first-sync-timeout', {
      timeoutMs: FIRST_SYNC_TIMEOUT_MS
    })

    h2.startSync()
    h2.session.onSyncStep(encodeSyncFrame('doc-1', 0, 0, Y.encodeStateVector(serverDoc)))
    h2.session.onSyncStep(
      encodeSyncFrame('doc-1', 0, 1, Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(h2.doc)))
    )
    h2.emitSynced()
    expect(h2.session.status).toBe('saving')
    h2.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h2.session.status).toBe('synced')
    h2.session.dispose()
  })

  it('ignores readonly updates/IDB deltas and resets non-owner saving or synced on live readOnly lock', () => {
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'server')
    const dirtyDoc = new Y.Doc()
    Y.applyUpdate(dirtyDoc, Y.encodeStateAsUpdate(serverDoc))
    dirtyDoc.getText('t').insert(6, ' dirty')

    const h = createTestSession({ readOnly: true })
    Y.applyUpdate(h.doc, Y.encodeStateAsUpdate(dirtyDoc))
    h.startSync()
    h.session.onSyncStep(encodeSyncFrame('doc-1', 0, 0, Y.encodeStateVector(serverDoc)))
    h.session.onSyncStep(
      encodeSyncFrame('doc-1', 0, 1, Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(h.doc)))
    )
    h.emitSynced()
    expect(h.session.status).toBe('saved')

    // Unlock as writer, edit to saving, then lock readOnly.
    h.setReadOnly(false)
    h.emitSyncAck()
    h.session.onLocalUpdate()
    h.emitUnsynced(1)
    expect(h.session.status).toBe('saving')

    h.setReadOnly(true)
    h.session.onReadOnlyLock()
    expect(h.session.status).toBe('saved')

    // Unlock, settle to synced, then lock readOnly.
    h.setReadOnly(false)
    h.emitSyncAck()
    h.session.onLocalUpdate()
    h.emitUnsynced(1)
    h.emitSyncAck()
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('synced')

    h.setReadOnly(true)
    h.session.onReadOnlyLock()
    expect(h.session.status).toBe('saved')

    // Disconnected status is preserved when readOnly arrives.
    h.session.onOffline()
    h.session.onReadOnlyLock()
    expect(h.session.status).toBe('offline')
    h.session.dispose()
  })

  it('enforces offline/error/unauthenticated precedence, document:saved, and auth recovery', async () => {
    const h = createTestSession()
    h.startSync()
    h.emitSynced()
    h.emitSyncAck()
    h.emitUnsynced(1)
    h.emitUnsynced(0)
    expect(h.session.status).toBe('saving')

    // document:saved cancels the 300ms settle window.
    h.session.onDocumentSaved()
    expect(h.session.status).toBe('saved')
    jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    expect(h.session.status).toBe('saved')

    // document:saved while unacked does not clear saving.
    h.emitUnsynced(2)
    h.session.onDocumentSaved()
    expect(h.session.status).toBe('saving')

    // Offline cancels pending grace/settle timers and blocks document:saved / unsyncedChanges.
    h.session.onDisconnect(1006)
    h.session.onOffline()
    expect(h.session.status).toBe('offline')
    jest.advanceTimersByTime(DISCONNECT_ERROR_GRACE_MS)
    expect(h.session.status).toBe('offline')
    h.session.onDocumentSaved()
    h.emitUnsynced(1)
    expect(h.session.status).toBe('offline')

    // Auth failure with session re-arms up to MAX_AUTH_REARM, and auth event cancels rearm & resets authStopped.
    h.setOnline(true)
    h.emitUnsynced(0)
    h.emitSynced()
    await h.session.onAuthFailed('expired', async () => true)
    expect(h.onDisconnect).toHaveBeenCalledTimes(1)
    expect(h.session.isAuthStopped).toBe(true)

    h.session.onAuthEvent('SIGNED_IN')
    expect(h.session.isAuthStopped).toBe(false)
    expect(h.onConnect).toHaveBeenCalledTimes(1)

    // Advancing past AUTH_REARM_DELAY_MS does not trigger the cancelled rearm timer.
    jest.advanceTimersByTime(AUTH_REARM_DELAY_MS)
    expect(h.onConnect).toHaveBeenCalledTimes(1)

    // Anonymous socket rescopes on SIGNED_IN.
    h.session.onTokenResolved(false)
    h.session.onAuthEvent('SIGNED_IN')
    expect(h.onDisconnect).toHaveBeenCalledTimes(2)
    h.session.onDisconnect(1000)
    expect(h.onConnect).toHaveBeenCalledTimes(2)

    // Terminal unauthenticated when no session remains.
    await h.session.onAuthFailed('invalid-token', async () => false)
    h.emitUnsynced(1)
    expect(h.session.status).toBe('unauthenticated')
    h.session.dispose()
  })

  it('ignores stale getSession resolution after dispose or auth recovery', async () => {
    const h = createTestSession()
    let resolveSession!: (hasSession: boolean) => void
    const pending = h.session.onAuthFailed(
      'race',
      () =>
        new Promise<boolean>((resolve) => {
          resolveSession = resolve
        })
    )

    h.session.onAuthEvent('TOKEN_REFRESHED')
    resolveSession(false)
    await pending

    expect(h.session.status).toBe('saved')
    expect(h.session.isAuthStopped).toBe(false)
    expect(h.onReportIssue).not.toHaveBeenCalled()

    const h2 = createTestSession()
    let resolveDisposed!: (hasSession: boolean) => void
    const pendingDisposed = h2.session.onAuthFailed(
      'unmount-race',
      () =>
        new Promise<boolean>((resolve) => {
          resolveDisposed = resolve
        })
    )
    h2.session.dispose()
    resolveDisposed(false)
    await pendingDisposed
    expect(h2.session.status).toBe('saved')
    expect(h2.onReportIssue).not.toHaveBeenCalled()
  })
})

describe('waitForLocalMirror', () => {
  it('resolves immediately when persistence is null without arming a timer', async () => {
    jest.useFakeTimers()
    try {
      const wait = waitForLocalMirror(null, IDB_HYDRATION_CAP_MS)
      expect(jest.getTimerCount()).toBe(0)
      await wait.promise
      wait.cancel()
    } finally {
      jest.useRealTimers()
    }
  })

  it('settles when whenSynced resolves or _db open rejects before cap, or on cap/cancel', async () => {
    jest.useFakeTimers()
    try {
      let resolveSynced!: () => void
      const whenSynced = new Promise<void>((resolve) => {
        resolveSynced = resolve
      })
      const w1 = waitForLocalMirror({ whenSynced, _db: new Promise(() => {}) }, 1_000)
      expect(jest.getTimerCount()).toBe(1)
      let done1 = false
      const p1 = w1.promise.then(() => {
        done1 = true
      })
      resolveSynced()
      await p1
      expect(done1).toBe(true)
      expect(jest.getTimerCount()).toBe(0)

      let rejectDb!: (err: Error) => void
      const dbErr = new Promise<void>((_, reject) => {
        rejectDb = reject
      })
      const w2 = waitForLocalMirror({ whenSynced: new Promise(() => {}), _db: dbErr }, 1_000)
      let done2 = false
      const p2 = w2.promise.then(() => {
        done2 = true
      })
      rejectDb(new Error('blocked'))
      await p2
      expect(done2).toBe(true)
      expect(jest.getTimerCount()).toBe(0)

      const w3 = waitForLocalMirror(
        { whenSynced: new Promise(() => {}), _db: new Promise(() => {}) },
        1_000
      )
      let done3 = false
      const p3 = w3.promise.then(() => {
        done3 = true
      })
      jest.advanceTimersByTime(999)
      await Promise.resolve()
      expect(done3).toBe(false)
      jest.advanceTimersByTime(1)
      await p3
      expect(done3).toBe(true)
      expect(jest.getTimerCount()).toBe(0)

      const w4 = waitForLocalMirror(
        { whenSynced: new Promise(() => {}), _db: new Promise(() => {}) },
        1_000
      )
      w4.cancel()
      await w4.promise
      expect(jest.getTimerCount()).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })
})
