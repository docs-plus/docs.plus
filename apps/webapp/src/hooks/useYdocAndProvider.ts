import {
  HocuspocusProvider,
  type HocuspocusProviderConfiguration,
  type HocuspocusProviderWebsocketConfiguration
} from '@hocuspocus/provider'
import { authStore, useStore } from '@stores'
import { applyAccessStateless } from '@utils/applyAccessStateless'
import { captureCollabIssueOnce, captureMessageOnce } from '@utils/observability'
import { supabaseClient } from '@utils/supabase'
import { onDocTitleStateless } from '@utils/titleWrite'
import { useEffect, useRef } from 'react'
import { IndexeddbPersistence, storeState } from 'y-indexeddb'
import * as Y from 'yjs'

import {
  CollabSession,
  FIRST_SYNC_TIMEOUT_MS,
  hasUnpushedLocalState,
  isDocumentAccessReadOnly,
  waitForLocalMirror
} from './collabSession'
import { guardProviderAwareness } from './guardProviderAwareness'

type DeviceType = 'desktop' | 'mobile' | 'tablet'

type ProviderOptions = HocuspocusProviderConfiguration &
  Pick<HocuspocusProviderWebsocketConfiguration, 'autoConnect'>

let persistRequested = false

// Keeps the mirror merge out of the load frames.
const MIRROR_COMPACT_DELAY_MS = 2000

// Asked on the first local edit, not on open, so readers never see Firefox's
// permission prompt. persisted() first stops a second ask once granted.
const requestPersistentStorage = () => {
  if (persistRequested) return
  persistRequested = true
  const storage = navigator.storage
  if (typeof storage?.persist !== 'function' || typeof storage.persisted !== 'function') return
  void storage
    .persisted()
    .then((granted) => granted || storage.persist())
    .catch(() => {})
}

interface UseYdocAndProviderProps {
  documentId: string
  slug: string
  deviceType?: DeviceType
}

const useYdocAndProvider = ({
  documentId,
  slug,
  deviceType = 'desktop'
}: UseYdocAndProviderProps): void => {
  const slugRef = useRef(slug)
  slugRef.current = slug
  const deviceTypeRef = useRef(deviceType)
  deviceTypeRef.current = deviceType
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  useEffect(() => {
    const providerUrl = process.env.NEXT_PUBLIC_PROVIDER_URL
    if (!providerUrl) {
      console.error('NEXT_PUBLIC_PROVIDER_URL not set')
      throw new Error('NEXT_PUBLIC_PROVIDER_URL not set')
    }

    let disposed = false
    const collabReported = new Set<string>()
    const ydoc = new Y.Doc()

    // Local mirror of every Y update: content typed just before a reload survives
    // a wedged persistence worker and re-syncs on reconnect. Cached doc bytes are
    // readable by later users of this browser profile — accepted trade-off.
    let persistence: IndexeddbPersistence | null = null
    let mirrorConstructorFailed = false
    try {
      if (typeof window.indexedDB !== 'undefined') {
        persistence = new IndexeddbPersistence(documentId, ydoc)
      }
    } catch {
      mirrorConstructorFailed = true
    }

    // The y-indexeddb patch (#751) reports failed writes as an 'error' event. Only a failed
    // update write means edits stop reaching the mirror. A full disk shows only as a commit
    // abort (QuotaExceededError in Chromium). `_db` is the only handle for a failed open.
    const flagMirrorFailed = () => {
      if (!disposed) setWorkspaceSetting('mirrorWriteFailed', true)
    }
    if (mirrorConstructorFailed) flagMirrorFailed()
    persistence?._db
      .then((db) => {
        if (disposed) return
        db.addEventListener('abort', (event) => {
          const error = (event.target as IDBTransaction | null)?.error
          if (error?.name === 'QuotaExceededError') flagMirrorFailed()
        })
      })
      .catch(flagMirrorFailed)
    persistence?.on('error', (err: unknown, kind: 'update' | 'load' | 'compact') => {
      if (disposed) return
      if (kind === 'update') flagMirrorFailed()
      captureMessageOnce(`idb:${kind}`, `idb:${kind}`, {
        level: 'warning',
        tags: { surface: 'offline-mirror' },
        extra: { detail: err instanceof Error ? err.message : String(err) }
      })
    })

    // y-indexeddb adds a full doc copy on each load and trims only past 500 rows, so the
    // replay grew by about 10 ms per reload of a large pad (#638). Merge to one row once
    // per mount, after first sync, with y-indexeddb's own trim.
    let mirrorCompactArmed = false
    let mirrorCompactTimer: ReturnType<typeof setTimeout> | null = null
    const compactMirror = () => {
      if (!persistence || mirrorCompactArmed || disposed) return
      mirrorCompactArmed = true
      void persistence.whenSynced.then(() => {
        if (disposed || persistence._destroyed) return
        mirrorCompactTimer = setTimeout(() => {
          mirrorCompactTimer = null
          if (disposed || persistence._destroyed || persistence._dbsize <= 1) return
          storeState(persistence).catch((err) => {
            if (!disposed) persistence.emit('error', [err, 'compact'])
          })
        }, MIRROR_COMPACT_DELAY_MS)
      })
    }

    let provider: HocuspocusProvider | null = null
    const isReadOnlyConnection = () =>
      provider?.authorizedScope === 'readonly' ||
      isDocumentAccessReadOnly(useStore.getState().settings, authStore.getState().profile?.id)

    const session = new CollabSession({
      getStatus: () => useStore.getState().settings.providerStatus,
      onStatusChange: (status) => {
        if (!disposed) setWorkspaceSetting('providerStatus', status)
      },
      isReadOnly: isReadOnlyConnection,
      hasUnsyncedChanges: () => Boolean(provider?.hasUnsyncedChanges),
      isSocketActive: () => {
        if (!provider) return false
        const ws = provider.configuration?.websocketProvider
        return ws ? ws.webSocket !== null && String(ws.status) !== 'disconnected' : true
      },
      onConnect: () => provider?.connect(),
      onDisconnect: () => provider?.disconnect(),
      hasUnpushedLocalState: (serverSV, serverUpdate) =>
        hasUnpushedLocalState(ydoc, serverSV, serverUpdate),
      onReportIssue: (kind, extra, level) =>
        captureCollabIssueOnce(collabReported, documentId, slugRef.current, kind, extra, level)
    })

    // StrictMode's dev double-mount auto-opens the socket then closes it mid-handshake
    // ("closed before established"). Defer connect() one tick so cleanup cancels it first;
    // autoConnect flows to the managed HocuspocusProviderWebsocket instance.
    const providerConfig: ProviderOptions = {
      url: providerUrl,
      name: documentId,
      document: ydoc,
      autoConnect: false,
      token: async () => {
        let { data, error } = await supabaseClient.auth.getSession()
        if (error) ({ data, error } = await supabaseClient.auth.getSession())
        if (error)
          console.debug(
            'WS token: getSession() failed twice, connecting anonymously',
            error.message
          )
        // The server decides readOnly once, inside onAuthenticate. A visitor who signs
        // in on a live anonymous socket therefore keeps anonymous scope until it reopens.
        session.onTokenResolved(Boolean(data.session?.user))
        return JSON.stringify({
          accessToken: data.session?.access_token ?? '',
          slug: slugRef.current,
          deviceType: deviceTypeRef.current
        })
      },
      onAuthenticationFailed: async ({ reason }) => {
        console.warn('WS authentication failed:', reason)
        await session.onAuthFailed(reason, async () => {
          const { data } = await supabaseClient.auth.getSession()
          return Boolean(data.session)
        })
      },
      onSynced: (data) => {
        session.onSynced(provider?.unsyncedChanges ?? 0, Boolean(provider?.hasUnsyncedChanges))

        if (data?.state) {
          setWorkspaceEditorSetting('providerSyncing', false)
          compactMirror()
        }

        if (data?.state && provider && !useStore.getState().settings.hocuspocusProvider) {
          setWorkspaceSetting('hocuspocusProvider', provider)
        }
      },
      onDisconnect: (data) => {
        session.onDisconnect(data.event?.code)
      },
      onStateless: ({ payload }) => {
        try {
          const data = JSON.parse(payload)

          if (data.msg === 'document:saved' && data.documentId === documentId) {
            console.info('📝 Document saved to DB:', data)
            session.onDocumentSaved()
            return
          }

          if (data.type === 'docTitle') {
            onDocTitleStateless()
            return
          }

          // applyAccessStateless owns the list of access types and ignores the rest.
          if (typeof data.type === 'string') {
            applyAccessStateless({
              documentId,
              slug: slugRef.current,
              data,
              stopReconnect: () => session.stopReconnect(),
              destroyProvider: () => {
                provider?.destroy()
                provider = null
              }
            })
            if (data.type === 'readOnly') {
              session.onReadOnlyLock()
            }
          }
        } catch {
          // Ignore malformed payloads
        }
      },
      onUnsyncedChanges: ({ number }) => {
        session.onUnsyncedChanges(number)
      },
      onDestroy: () => {
        session.dispose()
        setWorkspaceSetting('providerStatus', 'saved')
        setWorkspaceEditorSetting('loading', true)
        setWorkspaceEditorSetting('providerSyncing', true)
        setWorkspaceSetting('hocuspocusProvider', null)
      }
    }

    const handleProviderMessage = ({ event }: { event?: { data?: unknown } }) => {
      session.onSyncStep(event?.data)
    }

    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      // origin === persistence covers both initial and late IDB replay as well as compaction.
      if (
        (provider !== null && origin === provider) ||
        (persistence !== null && origin === persistence)
      ) {
        return
      }
      session.onLocalUpdate()
      // Past first sync, so mirror replay and the mount scaffold never ask, but an
      // offline edit does. providerSyncing stays false through a disconnect.
      if (!useStore.getState().settings.editor.providerSyncing) requestPersistentStorage()
    }
    ydoc.on('update', handleUpdate)

    let connectTimer: ReturnType<typeof setTimeout> | null = null
    let firstSyncTimer: ReturnType<typeof setTimeout> | null = null
    const startProvider = () => {
      if (disposed || provider) return
      provider = new HocuspocusProvider(providerConfig)
      guardProviderAwareness(provider)
      provider.on('message', handleProviderMessage)
      setWorkspaceSetting('hocuspocusProvider', provider)
      connectTimer = setTimeout(() => {
        if (!disposed) provider?.connect()
      }, 0)
      firstSyncTimer = setTimeout(() => session.onFirstSyncTimeout(), FIRST_SYNC_TIMEOUT_MS)
    }

    const hydrationWait = waitForLocalMirror(persistence)
    if (!persistence) {
      hydrationWait.cancel()
      startProvider()
    } else {
      void hydrationWait.promise.then(startProvider)
    }

    const { data: authSubscription } = supabaseClient.auth.onAuthStateChange((event) => {
      session.onAuthEvent(event)
    })

    const handleOnline = () => session.onReconnect()
    const handleOffline = () => {
      console.info('Browser is offline')
      session.onOffline()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') session.onReconnect()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      hydrationWait.cancel()
      if (connectTimer) clearTimeout(connectTimer)
      if (firstSyncTimer) clearTimeout(firstSyncTimer)
      if (mirrorCompactTimer) {
        clearTimeout(mirrorCompactTimer)
        mirrorCompactTimer = null
      }
      authSubscription.subscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      persistence?.destroy()
      setWorkspaceSetting('mirrorWriteFailed', false)
      provider?.off('message', handleProviderMessage)
      provider?.destroy()
      provider = null
      session.dispose()
      ydoc.off('update', handleUpdate)
      ydoc.destroy()
      collabReported.clear()
    }
  }, [documentId, setWorkspaceEditorSetting, setWorkspaceSetting])
}

export default useYdocAndProvider
