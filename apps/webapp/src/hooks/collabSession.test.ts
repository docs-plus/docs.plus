import { runInNewContext } from 'node:vm'

import type { ProviderStatus } from '@types'
import * as Y from 'yjs'

import {
  hasUnpushedLocalState,
  isDocumentAccessReadOnly,
  parseIncomingSyncStep,
  resolveUnsyncedChangesAction,
  shouldRestoreSavedOnReconnect
} from './collabSession'

jest.mock('@stores', () => ({
  useAuthStore: { getState: () => ({ profile: null }) }
}))

describe('resolveUnsyncedChangesAction', () => {
  const disconnectedStatuses: ProviderStatus[] = ['offline', 'error', 'unauthenticated']
  const healthyStatuses: ProviderStatus[] = ['saved', 'synced', 'saving']

  it('ignores all counts before first sync or while disconnected/auth-stopped/read-only', () => {
    for (const unsyncedCount of [0, 1, 5]) {
      expect(
        resolveUnsyncedChangesAction({
          unsyncedCount,
          previousUnsyncedCount: 0,
          isSynced: false,
          authStopped: false,
          isReadOnly: false,
          currentStatus: 'saved'
        })
      ).toEqual({ type: 'ignore' })

      expect(
        resolveUnsyncedChangesAction({
          unsyncedCount,
          previousUnsyncedCount: 0,
          isSynced: true,
          authStopped: true,
          isReadOnly: false,
          currentStatus: 'saved'
        })
      ).toEqual({ type: 'ignore' })

      expect(
        resolveUnsyncedChangesAction({
          unsyncedCount,
          previousUnsyncedCount: 0,
          isSynced: true,
          authStopped: false,
          isReadOnly: true,
          currentStatus: 'saved'
        })
      ).toEqual({ type: 'ignore' })

      for (const status of disconnectedStatuses) {
        expect(
          resolveUnsyncedChangesAction({
            unsyncedCount,
            previousUnsyncedCount: 0,
            isSynced: true,
            authStopped: false,
            isReadOnly: false,
            currentStatus: status
          })
        ).toEqual({ type: 'ignore' })
      }
    }
  })

  it('returns saving immediately when unsyncedCount rises above previousUnsyncedCount or while already saving', () => {
    for (const currentStatus of healthyStatuses) {
      expect(
        resolveUnsyncedChangesAction({
          unsyncedCount: 1,
          previousUnsyncedCount: 0,
          isSynced: true,
          authStopped: false,
          isReadOnly: false,
          currentStatus
        })
      ).toEqual({ type: 'saving' })
    }

    expect(
      resolveUnsyncedChangesAction({
        unsyncedCount: 3,
        previousUnsyncedCount: 2,
        isSynced: true,
        authStopped: false,
        isReadOnly: false,
        currentStatus: 'saved'
      })
    ).toEqual({ type: 'saving' })

    expect(
      resolveUnsyncedChangesAction({
        unsyncedCount: 3,
        previousUnsyncedCount: 2,
        isSynced: true,
        authStopped: false,
        isReadOnly: false,
        currentStatus: 'synced'
      })
    ).toEqual({ type: 'saving' })

    expect(
      resolveUnsyncedChangesAction({
        unsyncedCount: 1,
        previousUnsyncedCount: 2,
        isSynced: true,
        authStopped: false,
        isReadOnly: false,
        currentStatus: 'saving'
      })
    ).toEqual({ type: 'saving' })
  })

  it('ignores non-increasing pre-sync drains (2 -> 1) from saved or synced', () => {
    expect(
      resolveUnsyncedChangesAction({
        unsyncedCount: 1,
        previousUnsyncedCount: 2,
        isSynced: true,
        authStopped: false,
        isReadOnly: false,
        currentStatus: 'saved'
      })
    ).toEqual({ type: 'ignore' })

    expect(
      resolveUnsyncedChangesAction({
        unsyncedCount: 1,
        previousUnsyncedCount: 2,
        isSynced: true,
        authStopped: false,
        isReadOnly: false,
        currentStatus: 'synced'
      })
    ).toEqual({ type: 'ignore' })
  })

  it('schedules synced when unsyncedCount drops to 0 from saving, and ignores 0 from saved or synced', () => {
    expect(
      resolveUnsyncedChangesAction({
        unsyncedCount: 0,
        previousUnsyncedCount: 1,
        isSynced: true,
        authStopped: false,
        isReadOnly: false,
        currentStatus: 'saving'
      })
    ).toEqual({ type: 'schedule-synced' })

    expect(
      resolveUnsyncedChangesAction({
        unsyncedCount: 0,
        previousUnsyncedCount: 1,
        isSynced: true,
        authStopped: false,
        isReadOnly: false,
        currentStatus: 'saved'
      })
    ).toEqual({ type: 'ignore' })

    expect(
      resolveUnsyncedChangesAction({
        unsyncedCount: 0,
        previousUnsyncedCount: 1,
        isSynced: true,
        authStopped: false,
        isReadOnly: false,
        currentStatus: 'synced'
      })
    ).toEqual({ type: 'ignore' })
  })
})

describe('shouldRestoreSavedOnReconnect', () => {
  it('restores only when already synced and recovering from offline or error', () => {
    expect(shouldRestoreSavedOnReconnect(true, 'offline')).toBe(true)
    expect(shouldRestoreSavedOnReconnect(true, 'error')).toBe(true)
    expect(shouldRestoreSavedOnReconnect(false, 'offline')).toBe(false)
    expect(shouldRestoreSavedOnReconnect(true, 'unauthenticated')).toBe(false)
    expect(shouldRestoreSavedOnReconnect(true, 'saving')).toBe(false)
  })
})

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

describe('isDocumentAccessReadOnly', () => {
  it('detects readonly scope and non-owner metadata readOnly without locking on providerStatus error', () => {
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

    expect(
      isDocumentAccessReadOnly(
        {
          authorizedScope: 'read-write',
          metadata: { documentId: 'doc-1', readOnly: false, ownerId: 'owner-1' },
          providerStatus: 'error'
        } as Parameters<typeof isDocumentAccessReadOnly>[0],
        'user-1'
      )
    ).toBe(false)
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

  it('returns false when local IDB state matches server state including deletes', () => {
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'hello world')
    serverDoc.getText('t').delete(5, 6)

    const localDoc = new Y.Doc()
    Y.applyUpdate(localDoc, Y.encodeStateAsUpdate(serverDoc))

    const serverSV = Y.encodeStateVector(serverDoc)
    const serverUpdate = Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(localDoc))
    expect(hasUnpushedLocalState(localDoc, serverSV, serverUpdate)).toBe(false)
  })

  it('returns false when local IDB state is stale behind server inserts and deletes', () => {
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'initial')

    const localDoc = new Y.Doc()
    Y.applyUpdate(localDoc, Y.encodeStateAsUpdate(serverDoc))

    serverDoc.getText('t').insert(7, ' server-tail')
    serverDoc.getText('t').delete(0, 3)

    const serverSV = Y.encodeStateVector(serverDoc)
    const serverUpdate = Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(localDoc))
    expect(hasUnpushedLocalState(localDoc, serverSV, serverUpdate)).toBe(false)
  })

  it('returns true when local IDB state contains unpushed inserts', () => {
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'shared')

    const localDoc = new Y.Doc()
    Y.applyUpdate(localDoc, Y.encodeStateAsUpdate(serverDoc))
    localDoc.getText('t').insert(6, ' offline-insert')
    serverDoc.getText('t').insert(0, 'concurrent ')

    const serverSV = Y.encodeStateVector(serverDoc)
    const serverUpdate = Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(localDoc))
    expect(hasUnpushedLocalState(localDoc, serverSV, serverUpdate)).toBe(true)
  })

  it('returns true when local IDB state contains an unpushed delete-only mutation', () => {
    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'keep delete-me')

    const localDoc = new Y.Doc()
    Y.applyUpdate(localDoc, Y.encodeStateAsUpdate(serverDoc))
    localDoc.getText('t').delete(4, 10)

    const serverSV = Y.encodeStateVector(serverDoc)
    const serverUpdate = Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(localDoc))
    expect(hasUnpushedLocalState(localDoc, serverSV, serverUpdate)).toBe(true)
  })
})
