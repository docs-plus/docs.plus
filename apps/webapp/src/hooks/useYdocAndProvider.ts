import { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
import { supabaseClient } from '@utils/supabase'
import { useEffect, useRef } from 'react'
import * as Y from 'yjs'

/**
 * Provider Status Flow (Single Source of Truth):
 *
 * 1. User types → "saving" (changes being sent to server)
 * 2. Server receives → "synced" (in server memory, visible to other users)
 * 3. Server persists to DB → "saved" (durably stored, survives restart)
 *
 * The server debounces DB writes (10s), but syncs to memory immediately.
 * We only show "saved" when we get actual confirmation from the server.
 */

type DeviceType = 'desktop' | 'mobile' | 'tablet'

const FIRST_SYNC_TIMEOUT_MS = 15_000
// Bounded self-heal for a transient auth reject on a still-valid session: re-arm a few
// spaced reconnects, then fall back to the onAuthStateChange recovery (refresh/re-login).
const MAX_AUTH_REARM = 5
const AUTH_REARM_DELAY_MS = 3_000

interface UseYdocAndProviderProps {
  documentId: string
  slug: string
  accessToken: string
  deviceType?: DeviceType
}

const useYdocAndProvider = ({
  documentId,
  slug,
  accessToken,
  deviceType = 'desktop'
}: UseYdocAndProviderProps): void => {
  const ydocRef = useRef(new Y.Doc())
  const ydocDocumentIdRef = useRef<string | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const isSyncedRef = useRef(false)
  const syncedTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Auth-stop sentinel + re-arm budget, decoupled from providerStatus (which typing /
  // online events overwrite, so it can't gate recovery reliably).
  const authStoppedRef = useRef(false)
  const authRearmTimerRef = useRef<NodeJS.Timeout | null>(null)
  const authRearmCountRef = useRef(0)
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  useEffect(() => {
    const providerUrl = process.env.NEXT_PUBLIC_PROVIDER_URL
    if (!providerUrl) {
      console.error('NEXT_PUBLIC_PROVIDER_URL not set')
      throw new Error('NEXT_PUBLIC_PROVIDER_URL not set')
    }

    // Doc switch: the previous Y.Doc still holds the old document's content and
    // metadata (incl. needsInitialization=false) and would merge it into the new
    // room on sync — the new provider must wrap a clean doc.
    if (ydocDocumentIdRef.current && ydocDocumentIdRef.current !== documentId) {
      ydocRef.current = new Y.Doc()
    }
    ydocDocumentIdRef.current = documentId

    providerRef.current = new HocuspocusProvider({
      url: providerUrl,
      name: documentId,
      document: ydocRef.current,
      // Resolve a FRESH token on every (re)connect. A static string is frozen at
      // SSR, so once its JWT expires the provider reconnects forever with the dead
      // token; getSession() returns the browser client's auto-refreshed token.
      token: async () => {
        const { data, error } = await supabaseClient.auth.getSession()
        if (error) console.debug('WS token: getSession() failed, using fallback', error.message)
        return JSON.stringify({
          accessToken: data.session?.access_token ?? accessToken ?? '',
          slug,
          deviceType
        })
      },
      onAuthenticationFailed: async ({ reason }) => {
        // Stop the unbounded reconnect loop (disconnect -> shouldConnect=false) so a dead
        // token can't hammer the server. authStoppedRef is the recovery sentinel.
        console.warn('WS authentication failed:', reason)
        authStoppedRef.current = true
        providerRef.current?.disconnect()
        // Definitive (no session: logged out / expired refresh) stays stopped until a
        // later SIGNED_IN. Transient (still-valid session, e.g. a rate-limited verify)
        // self-heals: re-arm a bounded, capped reconnect that mints a fresh token.
        const { data } = await supabaseClient.auth.getSession()
        const canRearm = Boolean(data.session) && authRearmCountRef.current < MAX_AUTH_REARM
        if (canRearm) {
          authRearmCountRef.current += 1
          if (authRearmTimerRef.current) clearTimeout(authRearmTimerRef.current)
          authRearmTimerRef.current = setTimeout(
            () => providerRef.current?.connect(),
            AUTH_REARM_DELAY_MS
          )
          return
        }
        setWorkspaceSetting('providerStatus', 'error')
      },
      onSynced: (data) => {
        isSyncedRef.current = true
        // A successful (re)connect clears the auth-stop sentinel + re-arm budget.
        authStoppedRef.current = false
        authRearmCountRef.current = 0

        // Initial sync complete - document loaded from server (already saved)
        setWorkspaceSetting('providerStatus', 'saved')

        if (data?.state) setWorkspaceEditorSetting('providerSyncing', false)

        // in case of renew provider, set the provider to the store
        // (live store read — the effect closure can hold a stale value across doc switches)
        if (data?.state && !useStore.getState().settings.hocuspocusProvider) {
          setWorkspaceSetting('hocuspocusProvider', providerRef.current)
        }
      },
      onDisconnect: (data) => {
        isSyncedRef.current = false

        // Check if browser is offline
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setWorkspaceSetting('providerStatus', 'offline')
        } else if (data.event?.code && data.event.code !== 1000) {
          // Non-normal closure, show error
          setWorkspaceSetting('providerStatus', 'error')
        }
      },
      onStateless: ({ payload }) => {
        try {
          const data = JSON.parse(payload)

          // Listen for save confirmations from server (real DB persistence)
          // This is the ONLY place where we set "saved" - Single Source of Truth
          if (data.msg === 'document:saved' && data.documentId === documentId) {
            console.info('📝 Document saved to DB:', data)
            setWorkspaceSetting('providerStatus', 'saved')
          }
        } catch {
          // Ignore malformed payloads
        }
      },
      onDestroy: () => {
        setWorkspaceSetting('providerStatus', 'saved')
        setWorkspaceEditorSetting('loading', true)
        setWorkspaceEditorSetting('providerSyncing', true)
        setWorkspaceSetting('hocuspocusProvider', null)
        setWorkspaceEditorSetting('presentUsers', [])
      },
      // StrictMode's dev double-mount auto-opens this socket then closes it mid-
      // handshake ("closed before established"). Defer connect() (below) so cleanup
      // cancels it first; autoConnect flows to the managed socket (not in its type).
      ...{ autoConnect: false }
    })

    // Unconditional + idempotent: the store value here is either null (fresh
    // mount / post-destroy) or this same provider; a closure-guarded set goes
    // stale across doc switches and strands the page on the skeleton.
    setWorkspaceSetting('hocuspocusProvider', providerRef.current)

    // Connect on the next tick (see autoConnect above): the throwaway StrictMode
    // mount clears this before any socket opens; the surviving mount connects.
    const connectTimer = setTimeout(() => providerRef.current?.connect(), 0)

    return () => {
      clearTimeout(connectTimer)
      if (authRearmTimerRef.current) clearTimeout(authRearmTimerRef.current)
      providerRef.current?.destroy()
      // Without these, the next documentId's effect would see a truthy ref to a
      // destroyed provider and skip recreation, its watchdog would see the old
      // doc's synced=true, or auth re-arm budget from the prior doc would block
      // self-heal on the new one.
      providerRef.current = null
      isSyncedRef.current = false
      authStoppedRef.current = false
      authRearmCountRef.current = 0
    }
    // slug/accessToken/deviceType are connection metadata — only a documentId
    // change warrants a provider rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  // Recovery from an auth-stopped provider: a freshly-refreshed or re-logged-in session
  // must re-arm. Gate on authStoppedRef (NOT providerStatus, which typing/online events
  // overwrite). A definitive logout never emits these events, so it stays stopped.
  // (Supabase also re-emits SIGNED_IN on a hidden->visible tab, covering focus return.)
  useEffect(() => {
    const { data } = supabaseClient.auth.onAuthStateChange((event) => {
      if (event !== 'TOKEN_REFRESHED' && event !== 'SIGNED_IN') return
      if (!authStoppedRef.current) return
      authRearmCountRef.current = 0 // fresh credentials -> restore the re-arm budget
      providerRef.current?.connect()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // First-sync watchdog per document: a created-but-never-syncing provider would
  // otherwise leave the shell on bones forever. Keep an accurate 'offline' as is.
  useEffect(() => {
    const deadline = setTimeout(() => {
      const { providerStatus: current } = useStore.getState().settings
      if (!isSyncedRef.current && current !== 'offline') {
        setWorkspaceSetting('providerStatus', 'error')
      }
    }, FIRST_SYNC_TIMEOUT_MS)
    return () => clearTimeout(deadline)
  }, [documentId, setWorkspaceSetting])

  // Track Y.Doc updates for sync state (local changes only)
  useEffect(() => {
    const ydoc = ydocRef.current

    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      // Only track local updates, ignore remote updates from provider
      if (origin === providerRef.current) return

      // Don't change state if browser is offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }

      // Clear any pending timeout
      if (syncedTimeoutRef.current) {
        clearTimeout(syncedTimeoutRef.current)
      }

      // Show "saving" immediately - changes are being sent to server
      setWorkspaceSetting('providerStatus', 'saving')

      // After 300ms of no updates, show "synced" (WebSocket is real-time, ~50-100ms latency)
      // This gives user feedback that changes are on the server (in memory)
      // "saved" will come from server when DB write completes (after 10s debounce)
      syncedTimeoutRef.current = setTimeout(() => {
        // Live read — a closure-captured status here is stale by the time the
        // timer fires and would cancel its own transition.
        const { providerStatus: current } = useStore.getState().settings
        if (current === 'saving') {
          setWorkspaceSetting('providerStatus', 'synced')
        }
      }, 300)
    }

    ydoc.on('update', handleUpdate)

    return () => {
      ydoc.off('update', handleUpdate)
      if (syncedTimeoutRef.current) {
        clearTimeout(syncedTimeoutRef.current)
      }
    }
    // documentId re-attaches the listener to the fresh Y.Doc after a doc switch.
  }, [setWorkspaceSetting, documentId])

  // Track browser online/offline state
  useEffect(() => {
    let onlineTimeout: NodeJS.Timeout | null = null

    const handleOnline = () => {
      console.info('Browser is online')

      // Show "online" status immediately
      setWorkspaceSetting('providerStatus', 'online')

      // After 1.5 seconds, transition to "synced"
      onlineTimeout = setTimeout(() => {
        if (providerRef.current) {
          setWorkspaceSetting('providerStatus', 'synced')
        }
      }, 1500)
    }

    const handleOffline = () => {
      console.info('Browser is offline')
      setWorkspaceSetting('providerStatus', 'offline')

      // Clear any pending online timeout
      if (onlineTimeout) {
        clearTimeout(onlineTimeout)
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (onlineTimeout) {
        clearTimeout(onlineTimeout)
      }
    }
  }, [setWorkspaceSetting])
}

export default useYdocAndProvider
