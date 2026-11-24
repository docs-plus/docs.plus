import { authStore, useStore } from '@stores'
import { act, renderHook } from '@testing-library/react'
import * as Y from 'yjs'

import {
  DISCONNECT_ERROR_GRACE_MS,
  FIRST_SYNC_TIMEOUT_MS,
  SYNCED_SETTLE_DELAY_MS
} from './collabSession'
import useYdocAndProvider from './useYdocAndProvider'

type ProviderConfig = {
  document: Y.Doc
  onAuthenticationFailed?: (data: { reason: string }) => void
  onSynced?: (data: { state: boolean }) => void
  onDisconnect?: (data: { event?: { code?: number } }) => void
  onStateless?: (data: { payload: string }) => void
  onUnsyncedChanges?: (data: { number: number }) => void
  onDestroy?: () => void
}

type Listener = (...args: unknown[]) => void

class FakeHocuspocusProvider {
  unsyncedChanges = 0
  authorizedScope: 'read-write' | 'readonly' | undefined = 'read-write'
  awareness = null
  private listeners = new Map<string, Set<Listener>>()
  connect = jest.fn()
  disconnect = jest.fn()
  destroy = jest.fn(() => {
    this.configuration.onDestroy?.()
  })

  constructor(public configuration: ProviderConfig) {}

  get hasUnsyncedChanges(): boolean {
    return this.unsyncedChanges > 0
  }

  on(event: string, fn: Listener): this {
    const set = this.listeners.get(event) ?? new Set()
    set.add(fn)
    this.listeners.set(event, set)
    return this
  }

  off(event: string, fn?: Listener): this {
    if (!fn) {
      this.listeners.delete(event)
      return this
    }
    this.listeners.get(event)?.delete(fn)
    return this
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }

  emitMessage(data: unknown): void {
    for (const fn of this.listeners.get('message') ?? []) {
      fn({ event: { data } })
    }
  }

  startSync(): void {
    this.emitUnsyncedChanges(1)
  }

  emitSyncStatus(applied = true): void {
    if (!applied) return
    if (this.unsyncedChanges > 0) this.unsyncedChanges -= 1
    this.configuration.onUnsyncedChanges?.({ number: this.unsyncedChanges })
  }

  emitUnsyncedChanges(count: number): void {
    this.unsyncedChanges = count
    this.configuration.onUnsyncedChanges?.({ number: count })
  }

  emitSynced(state = true): void {
    this.configuration.onSynced?.({ state })
  }

  emitDisconnect(code = 1006): void {
    this.configuration.onDisconnect?.({ event: { code } })
  }

  emitStateless(payload: Record<string, unknown>): void {
    this.configuration.onStateless?.({ payload: JSON.stringify(payload) })
  }

  emitAuthFailed(reason = 'unauthorized'): void {
    this.configuration.onAuthenticationFailed?.({ reason })
  }
}

class FakeIndexeddbPersistence {
  _db = Promise.resolve({ addEventListener: jest.fn() })
  _destroyed = false
  _dbsize = 1
  whenSynced = Promise.resolve()
  on = jest.fn()
  destroy = jest.fn(() => {
    this._destroyed = true
  })

  constructor(
    public name: string,
    public doc: Y.Doc
  ) {}
}

let latestProvider: FakeHocuspocusProvider | null = null
let latestPersistence: FakeIndexeddbPersistence | null = null
let mockUseStore: typeof useStore

jest.mock('y-indexeddb', () => ({
  IndexeddbPersistence: jest.fn((name: string, doc: Y.Doc) => {
    latestPersistence = new FakeIndexeddbPersistence(name, doc)
    return latestPersistence
  }),
  storeState: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: jest.fn((config: ProviderConfig) => {
    latestProvider = new FakeHocuspocusProvider(config)
    return latestProvider
  })
}))

jest.mock('@stores', () => {
  const { create: createStore } = jest.requireActual('zustand')
  const authStore = createStore(() => ({ profile: { id: 'user-1' } }))
  const useStore = createStore((set: any, get: any) => ({
    settings: {
      metadata: { documentId: 'doc-1', readOnly: false, ownerId: 'owner-1' },
      providerStatus: 'saved',
      authorizedScope: null,
      hocuspocusProvider: undefined,
      mirrorWriteFailed: false,
      editor: { providerSyncing: true, loading: true, isEditable: true }
    },
    setWorkspaceSetting: (key: string, value: unknown) => {
      if (Object.is(get().settings[key], value)) return
      set((s: any) => ({ settings: { ...s.settings, [key]: value } }))
    },
    setWorkspaceEditorSetting: (key: string, value: unknown) =>
      set((s: any) => ({
        settings: { ...s.settings, editor: { ...s.settings.editor, [key]: value } }
      }))
  }))
  return { authStore, useAuthStore: authStore, useStore }
})

jest.mock('@utils/supabase', () => ({
  supabaseClient: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
    }
  }
}))

jest.mock('@utils/applyAccessStateless', () => ({
  applyAccessStateless: jest.fn(
    ({ documentId, data }: { documentId: string; data: { type?: string; state?: unknown } }) => {
      if (data?.type !== 'readOnly') return
      const { settings, setWorkspaceSetting } = mockUseStore.getState()
      if (settings.metadata.documentId === documentId) {
        setWorkspaceSetting('metadata', {
          ...settings.metadata,
          readOnly: Boolean(data.state)
        })
      }
    }
  )
}))
jest.mock('@utils/observability', () => ({
  captureCollabIssueOnce: jest.fn(),
  captureMessageOnce: jest.fn()
}))
jest.mock('@utils/titleWrite', () => ({ onDocTitleStateless: jest.fn() }))
jest.mock('./guardProviderAwareness', () => ({ guardProviderAwareness: jest.fn() }))

function writeVarUint(out: number[], value: number): void {
  let num = value
  while (num >= 0x80) {
    out.push(0x80 | (num & 0x7f))
    num = Math.floor(num / 128)
  }
  out.push(num & 0x7f)
}

function encodeSyncFrame(docName: string, syncType: 0 | 1, payload: Uint8Array): Uint8Array {
  const out: number[] = []
  const nameBytes = Buffer.from(docName, 'utf8')
  writeVarUint(out, nameBytes.length)
  out.push(...nameBytes)
  writeVarUint(out, 0)
  writeVarUint(out, syncType)
  writeVarUint(out, payload.length)
  out.push(...payload)
  return new Uint8Array(out)
}

const status = () => useStore.getState().settings.providerStatus

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  latestProvider = null
  latestPersistence = null
  mockUseStore = useStore
  process.env.NEXT_PUBLIC_PROVIDER_URL = 'wss://ws.example.com'
  authStore.setState({ profile: { id: 'user-1' } } as never)
  useStore.setState({
    settings: {
      metadata: { documentId: 'doc-1', readOnly: false, ownerId: 'owner-1' },
      providerStatus: 'saved',
      authorizedScope: null,
      hocuspocusProvider: undefined,
      mirrorWriteFailed: false,
      editor: { providerSyncing: true, loading: true, isEditable: true }
    }
  } as never)
})

afterEach(() => {
  delete (window as { indexedDB?: unknown }).indexedDB
  jest.useRealTimers()
})

describe('useYdocAndProvider unsyncedChanges sync driver', () => {
  it('sets saving immediately when unsyncedChanges > 0 and settles to synced after 300ms at 0', async () => {
    const persist = jest.fn().mockResolvedValue(true)
    const persisted = jest.fn().mockResolvedValue(false)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persisted, persist }
    })

    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saved')

    // Local Y.Doc update triggers persistent storage request, not the legacy blind timer.
    act(() => provider.configuration.document.getText('t').insert(0, 'a'))
    await act(async () => {})
    expect(persisted).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(status()).toBe('saved')

    act(() => provider.emitUnsyncedChanges(1))
    expect(status()).toBe('saving')

    act(() => provider.emitUnsyncedChanges(0))
    act(() => jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS - 1))
    expect(status()).toBe('saving')

    act(() => jest.advanceTimersByTime(1))
    expect(status()).toBe('synced')

    unmount()
    expect(provider.listenerCount('message')).toBe(0)
  })

  it('cancels the 300ms settle timer when unsyncedChanges rises above 0', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
      provider.emitSyncStatus(true)
      provider.configuration.document.getText('t').insert(0, 'a')
      provider.emitUnsyncedChanges(1)
      provider.emitUnsyncedChanges(0)
    })

    act(() => jest.advanceTimersByTime(150))
    expect(status()).toBe('saving')

    act(() => provider.emitUnsyncedChanges(1))
    act(() => jest.advanceTimersByTime(300))
    expect(status()).toBe('saving')

    act(() => provider.emitUnsyncedChanges(0))
    act(() => jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS))
    expect(status()).toBe('synced')

    unmount()
  })

  it('ignores startSync unsyncedChanges on clean open and reconnect and preserves saved', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider.emitDisconnect(1006)
      provider.startSync()
    })
    expect(status()).toBe('saved')

    act(() => jest.advanceTimersByTime(DISCONNECT_ERROR_GRACE_MS))
    expect(status()).toBe('error')

    // Clean reconnect in real wire order: onSynced fires while startSync leaves unsyncedChanges === 1.
    act(() => {
      provider.startSync()
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saved')

    unmount()
  })

  it('holds saving on offline-to-online reconnect until SyncStatus drops unsyncedChanges to 0', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
      provider.emitSyncStatus(true)
    })

    act(() => {
      window.dispatchEvent(new Event('offline'))
      provider.configuration.document.getText('t').insert(0, 'offline')
      provider.unsyncedChanges = 3
    })
    expect(status()).toBe('offline')

    // Online before socket closed: reconnect() must not jump to 'saved' with unsynced changes.
    act(() => window.dispatchEvent(new Event('online')))
    expect(status()).toBe('saving')

    // Full disconnect + reconnect cycle: onSynced while hasUnsyncedChanges keeps 'saving'.
    act(() => {
      provider.emitDisconnect(1006)
      window.dispatchEvent(new Event('offline'))
      provider.configuration.document.getText('t').insert(0, 'more')
    })
    expect(status()).toBe('offline')

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
    })
    expect(status()).toBe('saving')

    act(() => provider.emitSyncStatus(true))
    act(() => jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS - 1))
    expect(status()).toBe('saving')

    act(() => jest.advanceTimersByTime(1))
    expect(status()).toBe('synced')

    unmount()
  })

  it('detects dirty IDB state via SyncStep1/SyncStep2 while settling matching IDB with deletes and readonly pads to saved', () => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {}
    })

    // Case 1: Dirty IDB replay before SyncStep2 holds 'saving' until SyncStatus(true).
    const serverDoc1 = new Y.Doc()
    serverDoc1.getText('t').insert(0, 'server')
    const dirtyIdbDoc = new Y.Doc()
    Y.applyUpdate(dirtyIdbDoc, Y.encodeStateAsUpdate(serverDoc1))
    dirtyIdbDoc.getText('t').insert(6, ' offline-idb')

    const hook1 = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider1 = latestProvider!
    const persistence1 = latestPersistence!

    act(() => {
      Y.applyUpdate(
        provider1.configuration.document,
        Y.encodeStateAsUpdate(dirtyIdbDoc),
        persistence1
      )
      provider1.startSync()
      provider1.emitMessage(encodeSyncFrame('doc-1', 0, Y.encodeStateVector(serverDoc1)))
      provider1.emitMessage(
        encodeSyncFrame(
          'doc-1',
          1,
          Y.encodeStateAsUpdate(serverDoc1, Y.encodeStateVector(provider1.configuration.document))
        )
      )
      provider1.emitSynced(true)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider1.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('synced')
    hook1.unmount()

    // Case 2: Matching IDB replay (including prior deletes) settles immediately to 'saved'.
    const serverDoc2 = new Y.Doc()
    serverDoc2.getText('t').insert(0, 'hello world')
    serverDoc2.getText('t').delete(5, 6)

    const hook2 = renderHook(() => useYdocAndProvider({ documentId: 'doc-2', slug: 'pad-2' }))
    const provider2 = latestProvider!
    const persistence2 = latestPersistence!

    act(() => {
      Y.applyUpdate(
        provider2.configuration.document,
        Y.encodeStateAsUpdate(serverDoc2),
        persistence2
      )
      provider2.startSync()
      provider2.emitMessage(encodeSyncFrame('doc-2', 0, Y.encodeStateVector(serverDoc2)))
      provider2.emitMessage(
        encodeSyncFrame(
          'doc-2',
          1,
          Y.encodeStateAsUpdate(serverDoc2, Y.encodeStateVector(provider2.configuration.document))
        )
      )
      provider2.emitSynced(true)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider2.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saved')
    hook2.unmount()

    // Case 3: Readonly connection ignores dirty IDB delta and settles to 'saved'.
    const hook3 = renderHook(() => useYdocAndProvider({ documentId: 'doc-3', slug: 'pad-3' }))
    const provider3 = latestProvider!
    const persistence3 = latestPersistence!
    provider3.authorizedScope = 'readonly'

    act(() => {
      Y.applyUpdate(
        provider3.configuration.document,
        Y.encodeStateAsUpdate(dirtyIdbDoc),
        persistence3
      )
      provider3.startSync()
      provider3.emitMessage(encodeSyncFrame('doc-3', 0, Y.encodeStateVector(serverDoc1)))
      provider3.emitMessage(
        encodeSyncFrame(
          'doc-3',
          1,
          Y.encodeStateAsUpdate(serverDoc1, Y.encodeStateVector(provider3.configuration.document))
        )
      )
      provider3.emitSynced(true)
    })
    expect(status()).toBe('saved')
    hook3.unmount()
  })

  it('holds saving when a local edit lands in the 1-RTT window before initial SyncStatus arrives', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    // Local edit occurs before SyncStep2's SyncStatus(true) arrives: unsyncedChanges rises 1 -> 2.
    act(() => {
      provider.configuration.document.getText('t').insert(0, 'x')
      provider.emitUnsyncedChanges(2)
    })
    expect(status()).toBe('saving')

    // SyncStep2's SyncStatus(true) drops count 2 -> 1; must remain saving.
    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saving')

    // Edit's SyncStatus(true) drops count 1 -> 0; settles after 300ms.
    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('synced')

    unmount()
  })

  it('handles brief disconnects while saving with unacked edits vs during the 300ms settle window', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
      provider.emitSyncStatus(true)
    })

    // Case 1: Brief disconnect with an unacked local edit holds saving across reconnect until SyncStatus(true).
    act(() => {
      provider.configuration.document.getText('t').insert(0, 'pending')
      provider.emitUnsyncedChanges(1)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitDisconnect(1006)
      provider.startSync()
      provider.emitSynced(true)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('synced')

    // Case 2: Brief disconnect during the 300ms settle window (after SyncStatus(true) acked 0) restores saved.
    act(() => {
      provider.configuration.document.getText('t').insert(0, 'acked')
      provider.emitUnsyncedChanges(1)
      provider.emitSyncStatus(true)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitDisconnect(1006)
      provider.startSync()
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saved')

    unmount()
  })

  it('resets non-owner saving or synced status to saved on live readOnly update without affecting owners or disconnected states', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
      provider.emitSyncStatus(true)
    })

    // Non-owner while 'saving' resets immediately to 'saved'.
    act(() => {
      provider.configuration.document.getText('t').insert(0, 'edit')
      provider.emitUnsyncedChanges(1)
    })
    expect(status()).toBe('saving')
    act(() => {
      provider.emitStateless({ type: 'readOnly', state: true })
      provider.emitSyncStatus(true)
    })
    expect(status()).toBe('saved')

    // Unlock, edit to 'synced', then live readOnly while 'synced' resets to 'saved'.
    act(() => provider.emitStateless({ type: 'readOnly', state: false }))
    act(() => {
      provider.configuration.document.getText('t').insert(0, 'edit2')
      provider.emitUnsyncedChanges(1)
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('synced')
    act(() => provider.emitStateless({ type: 'readOnly', state: true }))
    expect(status()).toBe('saved')

    // Owner remains unaffected by live readOnly while 'saving' and 'synced'.
    act(() => {
      authStore.setState({ profile: { id: 'owner-1' } } as never)
      provider.configuration.document.getText('t').insert(0, 'owner-edit')
      provider.emitUnsyncedChanges(1)
    })
    expect(status()).toBe('saving')
    act(() => provider.emitStateless({ type: 'readOnly', state: true }))
    expect(status()).toBe('saving')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('synced')
    act(() => provider.emitStateless({ type: 'readOnly', state: true }))
    expect(status()).toBe('synced')

    // Non-owner while disconnected keeps disconnected status.
    act(() => {
      authStore.setState({ profile: { id: 'user-1' } } as never)
      window.dispatchEvent(new Event('offline'))
      provider.emitStateless({ type: 'readOnly', state: true })
    })
    expect(status()).toBe('offline')

    unmount()
  })

  it('ignores unsyncedChanges for readonly scope and non-owners, while allowing owner edits on readOnly pads', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    // Case 1: readonly authorizedScope with stale unsyncedChanges
    provider.authorizedScope = 'readonly'
    act(() => {
      provider.unsyncedChanges = 2
      provider.emitSynced(true)
      provider.emitUnsyncedChanges(2)
    })
    expect(status()).toBe('saved')

    // Case 2: read-write scope fallback vs non-owner metadata readOnly lock
    provider.authorizedScope = 'read-write'
    act(() => {
      useStore.getState().setWorkspaceSetting('metadata', {
        documentId: 'doc-1',
        readOnly: true,
        ownerId: 'owner-1'
      })
      provider.emitUnsyncedChanges(2)
    })
    expect(status()).toBe('saved')

    // Case 3: owner on readOnly pad still transitions saving -> synced
    act(() => {
      authStore.setState({ profile: { id: 'owner-1' } } as never)
      provider.emitUnsyncedChanges(3)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitUnsyncedChanges(0)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('synced')

    unmount()
  })

  it('enforces offline/error/unauthenticated precedence and coordinates document:saved', async () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
      provider.emitSyncStatus(true)
      provider.emitUnsyncedChanges(1)
      provider.emitUnsyncedChanges(0)
    })
    expect(status()).toBe('saving')

    // document:saved during the 300ms hold window wins and cancels the synced timer.
    act(() => provider.emitStateless({ msg: 'document:saved', documentId: 'doc-1' }))
    expect(status()).toBe('saved')
    act(() => jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS))
    expect(status()).toBe('saved')

    // document:saved while local edits are still unacked does not clear saving.
    act(() => {
      provider.emitUnsyncedChanges(2)
      provider.emitStateless({ msg: 'document:saved', documentId: 'doc-1' })
    })
    expect(status()).toBe('saving')

    // Offline cancels any pending synced timer and blocks document:saved / unsyncedChanges.
    act(() => {
      provider.emitUnsyncedChanges(0)
      window.dispatchEvent(new Event('offline'))
    })
    expect(status()).toBe('offline')
    act(() => {
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
      provider.emitStateless({ msg: 'document:saved', documentId: 'doc-1' })
      provider.emitUnsyncedChanges(1)
    })
    expect(status()).toBe('offline')

    // Auth failure blocks unsyncedChanges as well.
    await act(async () => {
      provider.unsyncedChanges = 0
      provider.emitSynced(true)
      provider.emitAuthFailed('invalid-token')
      await Promise.resolve()
    })
    act(() => provider.emitUnsyncedChanges(1))
    expect(status()).toBe('unauthenticated')

    unmount()
  })

  it('cancels any pending 300ms settle timer on unmount', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
      provider.emitSyncStatus(true)
      provider.emitUnsyncedChanges(1)
      provider.emitUnsyncedChanges(0)
    })
    expect(status()).toBe('saving')

    unmount()
    expect(provider.listenerCount('message')).toBe(0)
    act(() => jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS))
    expect(status()).toBe('saved')
  })

  it('holds saving across 1006 disconnect grace expiry to error when local edits occurred before reconnect (Bug E1)', () => {
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!

    act(() => {
      provider.startSync()
      provider.emitSynced(true)
      provider.emitSyncStatus(true)
    })
    expect(status()).toBe('saved')

    // 1006 close arms the 3s grace timer; local edit inside the grace window sets pending edits.
    act(() => {
      provider.emitDisconnect(1006)
      jest.advanceTimersByTime(1000)
      provider.configuration.document.getText('t').insert(0, 'grace-edit')
      provider.emitUnsyncedChanges(1)
    })
    expect(status()).toBe('saved')

    // Grace expires -> providerStatus transitions to 'error'.
    act(() => jest.advanceTimersByTime(DISCONNECT_ERROR_GRACE_MS - 1000))
    expect(status()).toBe('error')

    // Reconnect onSynced while providerStatus === 'error' must hold 'saving' until SyncStatus(true).
    act(() => {
      provider.startSync()
      provider.emitSynced(true)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS - 1)
    })
    expect(status()).toBe('saving')

    act(() => jest.advanceTimersByTime(1))
    expect(status()).toBe('synced')

    unmount()
  })

  it('holds saving when first-sync timeout sets error before slow SyncStep1/SyncStep2 detects dirty IDB state (Bug E2)', () => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {}
    })

    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'server')
    const dirtyIdbDoc = new Y.Doc()
    Y.applyUpdate(dirtyIdbDoc, Y.encodeStateAsUpdate(serverDoc))
    dirtyIdbDoc.getText('t').insert(6, ' offline-idb')

    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!
    const persistence = latestPersistence!

    // IDB replays dirty state before initial sync completes.
    act(() => {
      Y.applyUpdate(
        provider.configuration.document,
        Y.encodeStateAsUpdate(dirtyIdbDoc),
        persistence
      )
    })

    // First-sync deadline fires -> providerStatus becomes 'error'.
    act(() => jest.advanceTimersByTime(FIRST_SYNC_TIMEOUT_MS))
    expect(status()).toBe('error')

    // Slow SyncStep1/SyncStep2 + onSynced arrives while providerStatus === 'error'.
    act(() => {
      provider.startSync()
      provider.emitMessage(encodeSyncFrame('doc-1', 0, Y.encodeStateVector(serverDoc)))
      provider.emitMessage(
        encodeSyncFrame(
          'doc-1',
          1,
          Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(provider.configuration.document))
        )
      )
      provider.emitSynced(true)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS - 1)
    })
    expect(status()).toBe('saving')

    act(() => jest.advanceTimersByTime(1))
    expect(status()).toBe('synced')

    unmount()
  })

  it('ignores clean IDB pre-sync 2 -> 1 -> 0 drain after onSynced while still capturing real post-sync edits', () => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {}
    })

    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'saved content')

    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!
    const persistence = latestPersistence!

    // Pre-sync startSync (unsyncedChanges=1) + clean IDB replay (unsyncedChanges=2) before SyncStep2.
    act(() => {
      provider.startSync()
      Y.applyUpdate(provider.configuration.document, Y.encodeStateAsUpdate(serverDoc), persistence)
      provider.emitUnsyncedChanges(2)
      provider.emitMessage(encodeSyncFrame('doc-1', 0, Y.encodeStateVector(serverDoc)))
      provider.emitMessage(
        encodeSyncFrame(
          'doc-1',
          1,
          Y.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(provider.configuration.document))
        )
      )
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    // First SyncStatus(true) drains 2 -> 1: must NOT flip 'saved' -> 'saving'.
    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saved')

    // Second SyncStatus(true) drains 1 -> 0: must stay 'saved' and never enter 'synced'.
    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saved')

    // Case A: Real local edit arrives right after onSynced while unsyncedChanges === 2 (2 -> 3).
    act(() => {
      provider.emitDisconnect(1006)
      provider.startSync()
      provider.emitUnsyncedChanges(2)
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider.configuration.document.getText('t').insert(0, 'a')
      provider.emitUnsyncedChanges(3)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitSyncStatus(true)
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('synced')

    // Case B: SyncStatus(true) #1 drains 2 -> 1 first (stays 'saved'), then real edit increments 1 -> 2.
    act(() => {
      provider.emitDisconnect(1006)
      provider.startSync()
      provider.emitUnsyncedChanges(2)
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('saved')

    act(() => {
      provider.configuration.document.getText('t').insert(0, 'b')
      provider.emitUnsyncedChanges(2)
    })
    expect(status()).toBe('saving')

    act(() => {
      provider.emitSyncStatus(true)
      provider.emitSyncStatus(true)
      jest.advanceTimersByTime(SYNCED_SETTLE_DELAY_MS)
    })
    expect(status()).toBe('synced')

    unmount()
  })
})
