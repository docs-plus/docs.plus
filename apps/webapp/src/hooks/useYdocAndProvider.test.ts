import { authStore, type IAuthStore, type IWorkspaceStore, useStore } from '@stores'
import { act, renderHook } from '@testing-library/react'
import type { Profile } from '@types'
import { applyAccessStateless } from '@utils/applyAccessStateless'
import type { DocumentMetadata } from '@utils/fetchDocument'
import { captureMessageOnce } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'
import { onDocTitleStateless } from '@utils/titleWrite'
import { IndexeddbPersistence, storeState } from 'y-indexeddb'
import * as Y from 'yjs'

import {
  AUTH_REARM_DELAY_MS,
  DISCONNECT_ERROR_GRACE_MS,
  FIRST_SYNC_TIMEOUT_MS,
  IDB_HYDRATION_CAP_MS,
  SYNCED_SETTLE_DELAY_MS
} from './collabSession'
import useYdocAndProvider from './useYdocAndProvider'

type ProviderConfig = {
  document: Y.Doc
  autoConnect?: boolean
  token?: () => Promise<string>
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

  emitSynced(state = true): void {
    this.configuration.onSynced?.({ state })
  }

  emitDisconnect(code = 1006): void {
    this.configuration.onDisconnect?.({ event: { code } })
  }

  emitUnsyncedChanges(count: number): void {
    this.unsyncedChanges = count
    this.configuration.onUnsyncedChanges?.({ number: count })
  }

  emitStateless(payload: Record<string, unknown>): void {
    this.configuration.onStateless?.({ payload: JSON.stringify(payload) })
  }

  emitAuthFailed(reason = 'unauthorized'): void {
    this.configuration.onAuthenticationFailed?.({ reason })
  }
}

class FakeIndexeddbPersistence {
  _db: Promise<{ addEventListener: jest.Mock }>
  _destroyed = false
  _dbsize = 1
  synced = false
  whenSynced: Promise<void>
  private errorListeners = new Set<Listener>()
  resolveDb!: (db: { addEventListener: jest.Mock }) => void
  rejectDb!: (err: unknown) => void
  resolveSynced!: () => void
  destroy = jest.fn(() => {
    this._destroyed = true
  })

  constructor(
    public name: string,
    public doc: Y.Doc
  ) {
    this._db = new Promise<{ addEventListener: jest.Mock }>((resolve, reject) => {
      this.resolveDb = resolve
      this.rejectDb = reject
    })
    if (holdNextIdbSync) {
      holdNextIdbSync = false
      this.whenSynced = new Promise<void>((resolve) => {
        this.resolveSynced = resolve
      })
    } else {
      this.whenSynced = Promise.resolve()
      this.resolveSynced = () => {}
    }
  }

  on(event: string, fn: Listener): void {
    if (event === 'error') this.errorListeners.add(fn)
  }

  emit(event: string, args: unknown[]): void {
    if (event !== 'error') return
    for (const fn of this.errorListeners) fn(...args)
  }
}

let latestProvider: FakeHocuspocusProvider | null = null
let latestPersistence: FakeIndexeddbPersistence | null = null
let authStateCallback: ((event: string) => void) | null = null
let holdNextIdbSync = false
const authUnsubscribe = jest.fn()

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
  const { create: createStore } = jest.requireActual<typeof import('zustand')>('zustand')
  const noop = () => {}
  const authStore = createStore<IAuthStore>(() => ({
    session: null,
    profile: null,
    profileError: false,
    loading: false,
    setSession: noop,
    setProfile: noop,
    setProfileError: noop,
    setLoading: noop
  }))
  const useStore = createStore<IWorkspaceStore>((set, get) => ({
    settings: {
      metadata: {
        documentId: 'doc-1',
        slug: 'pad',
        title: 'Pad',
        isPrivate: false,
        readOnly: false,
        ownerId: 'owner-1',
        keywords: [],
        docClientId: 'client-1'
      },
      providerStatus: 'saved',
      authorizedScope: null,
      hocuspocusProvider: undefined,
      mirrorWriteFailed: false,
      workspaceJoin: 'joined',
      editor: {
        providerSyncing: true,
        loading: true,
        isEditable: true,
        filterResult: { sortedSlugs: [] }
      }
    },
    setWorkspaceSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
    setWorkspaceSetting: (key, value) => {
      if (Object.is(get().settings[key], value)) return
      set((s) => ({ settings: { ...s.settings, [key]: value } }))
    },
    setWorkspaceEditorSettings: (editor) => set((s) => ({ settings: { ...s.settings, editor } })),
    setWorkspaceEditorSetting: (key, value) =>
      set((s) => ({
        settings: { ...s.settings, editor: { ...s.settings.editor, [key]: value } }
      }))
  }))
  return { authStore, useAuthStore: authStore, useStore }
})

jest.mock('@utils/supabase', () => ({
  supabaseClient: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn((cb: (event: string) => void) => {
        authStateCallback = cb
        return { data: { subscription: { unsubscribe: authUnsubscribe } } }
      })
    }
  }
}))

jest.mock('@utils/applyAccessStateless', () => ({ applyAccessStateless: jest.fn() }))
jest.mock('@utils/observability', () => ({
  captureCollabIssueOnce: jest.fn(),
  captureMessageOnce: jest.fn()
}))
jest.mock('@utils/titleWrite', () => ({ onDocTitleStateless: jest.fn() }))
jest.mock('./guardProviderAwareness', () => ({ guardProviderAwareness: jest.fn() }))

const makeProfile = (id: string): Profile => ({
  id,
  username: id,
  email: `${id}@example.com`,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  avatar_url: null,
  avatar_updated_at: null,
  display_name: null,
  full_name: null,
  status: 'ONLINE',
  user_details_json: null
})

const makeMetadata = (overrides?: Partial<DocumentMetadata>): DocumentMetadata => ({
  documentId: 'doc-1',
  slug: 'pad',
  title: 'Pad',
  isPrivate: false,
  readOnly: false,
  ownerId: 'owner-1',
  keywords: [],
  docClientId: 'client-1',
  ...overrides
})

const status = () => useStore.getState().settings.providerStatus
const originalStorageDescriptor = Object.getOwnPropertyDescriptor(navigator, 'storage')
const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB')

function restoreDescriptor(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor)
  } else {
    Reflect.deleteProperty(target, key)
  }
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  latestProvider = null
  latestPersistence = null
  authStateCallback = null
  holdNextIdbSync = false
  process.env.NEXT_PUBLIC_PROVIDER_URL = 'wss://ws.example.com'
  authStore.setState({ profile: makeProfile('user-1') })
  useStore.setState({
    settings: {
      metadata: makeMetadata(),
      providerStatus: 'saved',
      authorizedScope: null,
      hocuspocusProvider: undefined,
      mirrorWriteFailed: false,
      workspaceJoin: 'joined',
      editor: {
        providerSyncing: true,
        loading: true,
        isEditable: true,
        filterResult: { sortedSlugs: [] }
      }
    }
  })
})

afterEach(() => {
  restoreDescriptor(navigator, 'storage', originalStorageDescriptor)
  restoreDescriptor(window, 'indexedDB', originalIndexedDbDescriptor)
  jest.useRealTimers()
})

describe('useYdocAndProvider lifecycle and wiring', () => {
  it('defers connect(), passes autoConnect: false, tracks latest slug without recreating provider, and cleans up on unmount', async () => {
    const { rerender, unmount } = renderHook(
      ({ documentId, slug }: { documentId: string; slug: string }) =>
        useYdocAndProvider({ documentId, slug }),
      { initialProps: { documentId: 'doc-1', slug: 'old-slug' } }
    )
    const provider = latestProvider!
    const ydoc = provider.configuration.document
    const destroySpy = jest.spyOn(ydoc, 'destroy')

    expect(provider.configuration.autoConnect).toBe(false)
    expect(provider.connect).not.toHaveBeenCalled()
    expect(useStore.getState().settings.hocuspocusProvider).toBe(provider)

    act(() => jest.advanceTimersByTime(0))
    expect(provider.connect).toHaveBeenCalledTimes(1)

    // Renaming slug keeps the same provider & Y.Doc and resolves the fresh slug in token().
    rerender({ documentId: 'doc-1', slug: 'renamed-slug' })
    expect(latestProvider).toBe(provider)
    const tokenPayload = JSON.parse(await provider.configuration.token!()) as { slug: string }
    expect(tokenPayload.slug).toBe('renamed-slug')

    unmount()
    expect(provider.listenerCount('message')).toBe(0)
    expect(provider.destroy).toHaveBeenCalledTimes(1)
    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(authUnsubscribe).toHaveBeenCalledTimes(1)
    expect(useStore.getState().settings.hocuspocusProvider).toBeNull()
  })

  it('destroys old persistence, provider, and Y.Doc on documentId switch', async () => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} })

    const { rerender, unmount } = renderHook(
      ({ documentId }: { documentId: string }) =>
        useYdocAndProvider({ documentId, slug: documentId }),
      { initialProps: { documentId: 'doc-a' } }
    )
    await act(async () => {})
    const providerA = latestProvider!
    const persistenceA = latestPersistence!
    const destroyYdocA = jest.spyOn(providerA.configuration.document, 'destroy')

    rerender({ documentId: 'doc-b' })
    await act(async () => {})
    const providerB = latestProvider!

    expect(providerB).not.toBe(providerA)
    expect(persistenceA.destroy).toHaveBeenCalledTimes(1)
    expect(providerA.destroy).toHaveBeenCalledTimes(1)
    expect(destroyYdocA).toHaveBeenCalledTimes(1)
    expect(providerB.configuration.document).not.toBe(providerA.configuration.document)

    unmount()
  })

  it('cancels settle, error-grace, first-sync, and mirror-compaction timers on unmount', async () => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} })
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    await act(async () => {})
    const provider = latestProvider!
    const persistence = latestPersistence!
    persistence._dbsize = 4

    act(() => {
      provider.emitSynced(true)
      provider.emitUnsyncedChanges(1)
      provider.emitUnsyncedChanges(0)
    })
    await act(async () => {})
    expect(status()).toBe('saving')

    unmount()
    act(() => {
      jest.advanceTimersByTime(
        Math.max(SYNCED_SETTLE_DELAY_MS, DISCONNECT_ERROR_GRACE_MS, FIRST_SYNC_TIMEOUT_MS)
      )
    })
    expect(status()).toBe('saved')
    expect(storeState).not.toHaveBeenCalled()
  })

  it('guards async onAuthenticationFailed and persistence._db callbacks after unmount', async () => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} })
    type SessionResult = Awaited<ReturnType<typeof supabaseClient.auth.getSession>>
    let resolveSession!: (val: SessionResult) => void
    jest.mocked(supabaseClient.auth.getSession).mockImplementationOnce(
      () =>
        new Promise<SessionResult>((resolve) => {
          resolveSession = resolve
        })
    )

    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    await act(async () => {})
    const provider = latestProvider!
    const persistence = latestPersistence!
    const addEventListener = jest.fn()

    act(() => {
      provider.emitAuthFailed('race')
    })
    unmount()

    await act(async () => {
      persistence.resolveDb({ addEventListener })
      resolveSession({ data: { session: null }, error: null })
      await Promise.resolve()
    })

    expect(addEventListener).not.toHaveBeenCalled()
    expect(status()).toBe('saved')
    expect(useStore.getState().settings.mirrorWriteFailed).toBe(false)
  })

  it('resets authStopped and cancels pending authRearmTimer when onAuthStateChange triggers connect()', async () => {
    type SessionResult = Awaited<ReturnType<typeof supabaseClient.auth.getSession>>
    const sessionValue: NonNullable<SessionResult['data']['session']> = {
      access_token: 'tok',
      refresh_token: 'ref',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'user-1',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00Z'
      }
    }
    jest.mocked(supabaseClient.auth.getSession).mockResolvedValueOnce({
      data: { session: sessionValue },
      error: null
    })

    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    const provider = latestProvider!
    act(() => jest.advanceTimersByTime(0))
    provider.connect.mockClear()

    await act(async () => {
      provider.emitAuthFailed('expired')
      await Promise.resolve()
    })

    act(() => {
      authStateCallback?.('TOKEN_REFRESHED')
    })
    expect(provider.connect).toHaveBeenCalledTimes(1)

    // Cancelled rearm timer must not fire again after AUTH_REARM_DELAY_MS.
    act(() => jest.advanceTimersByTime(AUTH_REARM_DELAY_MS))
    expect(provider.connect).toHaveBeenCalledTimes(1)

    // Because authStopped was reset, a subsequent 1006 disconnect arms error grace normally.
    act(() => {
      provider.emitDisconnect(1006)
      jest.advanceTimersByTime(DISCONNECT_ERROR_GRACE_MS)
    })
    expect(status()).toBe('error')
    unmount()
  })

  it('ignores late IDB replay after first onSynced while requesting persistent storage on post-sync local edits', async () => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} })
    const persist = jest.fn().mockResolvedValue(true)
    const persisted = jest.fn().mockResolvedValue(false)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persisted, persist }
    })

    const serverDoc = new Y.Doc()
    serverDoc.getText('t').insert(0, 'server-text')

    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    await act(async () => {})
    const provider = latestProvider!
    const persistence = latestPersistence!

    // Server sync wins before IDB replay finishes.
    act(() => {
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    // Late clean IDB replay arrives after onSynced with origin === persistence.
    act(() => {
      Y.applyUpdate(provider.configuration.document, Y.encodeStateAsUpdate(serverDoc), persistence)
    })
    await act(async () => {})
    expect(persisted).not.toHaveBeenCalled()

    // Subsequent disconnect + reconnect with unsyncedChanges must stay 'saved', not 'saving'.
    act(() => {
      provider.emitDisconnect(1006)
      provider.unsyncedChanges = 1
      provider.emitSynced(true)
    })
    expect(status()).toBe('saved')

    // Real post-sync local edit requests persistent storage and flags pending local edits.
    act(() => {
      provider.configuration.document.getText('t').insert(0, 'local')
    })
    await act(async () => {})
    expect(persisted).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('wires stateless handlers, mirror error reporting, and delayed compaction', async () => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} })
    const { unmount } = renderHook(() => useYdocAndProvider({ documentId: 'doc-1', slug: 'pad' }))
    await act(async () => {})
    const provider = latestProvider!
    const persistence = latestPersistence!
    persistence._dbsize = 3

    act(() => {
      provider.emitSynced(true)
      provider.emitStateless({ type: 'docTitle' })
      provider.emitStateless({ type: 'readOnly', state: true })
      provider.emitStateless({ msg: 'document:saved', documentId: 'doc-1' })
      persistence.emit('error', [new Error('read fail'), 'load'])
    })

    expect(onDocTitleStateless).toHaveBeenCalledTimes(1)
    expect(applyAccessStateless).toHaveBeenCalledTimes(1)
    expect(captureMessageOnce).toHaveBeenCalledWith(
      'idb:load',
      'idb:load',
      expect.objectContaining({ level: 'warning' })
    )
    expect(useStore.getState().settings.mirrorWriteFailed).toBe(false)

    act(() => {
      persistence.emit('error', [new Error('write fail'), 'update'])
    })
    expect(useStore.getState().settings.mirrorWriteFailed).toBe(true)

    await act(async () => {})
    act(() => jest.advanceTimersByTime(2000))
    expect(storeState).toHaveBeenCalledWith(persistence)
    unmount()
  })

  it('waits for local IDB hydration before creating HocuspocusProvider, honors cap/errors, and skips on unmount', async () => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} })

    // 1. Waits while whenSynced is pending, then builds provider once whenSynced settles.
    holdNextIdbSync = true
    const r1 = renderHook(() => useYdocAndProvider({ documentId: 'doc-wait', slug: 'pad' }))
    expect(latestProvider).toBeNull()
    expect(useStore.getState().settings.hocuspocusProvider).toBeUndefined()

    await act(async () => {
      latestPersistence!.resolveSynced()
      await Promise.resolve()
    })
    expect(latestProvider).not.toBeNull()
    expect(useStore.getState().settings.hocuspocusProvider).toBe(latestProvider)
    r1.unmount()

    // 2. Builds provider after IDB_HYDRATION_CAP_MS when IndexedDB stalls.
    latestProvider = null
    holdNextIdbSync = true
    const r2 = renderHook(() => useYdocAndProvider({ documentId: 'doc-cap', slug: 'pad' }))
    expect(latestProvider).toBeNull()
    await act(async () => {
      jest.advanceTimersByTime(IDB_HYDRATION_CAP_MS)
      await Promise.resolve()
    })
    expect(latestProvider).not.toBeNull()
    r2.unmount()

    // 3. Does not construct provider if unmounted before hydration completes.
    latestProvider = null
    holdNextIdbSync = true
    const r3 = renderHook(() => useYdocAndProvider({ documentId: 'doc-unmount', slug: 'pad' }))
    const pendingPersistence = latestPersistence!
    r3.unmount()
    await act(async () => {
      pendingPersistence.resolveSynced()
      await Promise.resolve()
    })
    expect(latestProvider).toBeNull()

    // 4. Starts immediately when opening IndexeddbPersistence throws synchronously (blocked storage).
    latestProvider = null
    jest.mocked(IndexeddbPersistence).mockImplementationOnce(() => {
      throw new Error('SecurityError')
    })
    const r4 = renderHook(() => useYdocAndProvider({ documentId: 'doc-blocked', slug: 'pad' }))
    expect(latestProvider).not.toBeNull()
    expect(useStore.getState().settings.mirrorWriteFailed).toBe(true)
    r4.unmount()
  })
})
