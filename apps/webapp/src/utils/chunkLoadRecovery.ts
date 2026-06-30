import { matchesChunkError } from './chunkErrorPatterns'

/**
 * Auto-recover from deploy-boundary chunk-load failures by reloading once.
 * A stale hashed CSS/JS asset 404s after a deploy; one reload fetches fresh
 * HTML with new chunk hashes. A module-scope flag bounds it to one reload per
 * page execution; sessionStorage adds a cross-reload cooldown (best-effort).
 */
const RELOAD_KEY = 'docsplus.chunkReloadAt'
const RELOAD_COOLDOWN_MS = 10_000

let hasReloaded = false

const extractMessage = (event: ErrorEvent | PromiseRejectionEvent): string => {
  if (typeof (event as ErrorEvent).message === 'string') return (event as ErrorEvent).message
  const error = (event as { error?: Error }).error
  if (error?.message) return error.message
  const reason = (event as { reason?: unknown }).reason
  return reason instanceof Error ? reason.message : String(reason ?? '')
}

const reloadOnce = (): void => {
  // One reload per page execution, regardless of storage — guards against a burst
  // of simultaneous failed dynamic imports each calling reload().
  if (hasReloaded) return

  // sessionStorage throws in some private-browsing modes (iOS Safari); guard so a
  // storage error can't prevent the reload or throw inside the error listener.
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
  } catch {
    // No storage — skip the cross-reload cooldown; the module flag still bounds this load.
  }
  if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) return

  hasReloaded = true
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Private mode — cooldown not persisted; the module flag still prevents an in-page loop.
  }
  window.location.reload()
}

let installed = false

/** Install global listeners that reload the page on a stale-asset chunk failure. */
export const installChunkLoadRecovery = (): void => {
  if (typeof window === 'undefined' || installed) return
  installed = true

  const onError = (event: ErrorEvent) => {
    if (matchesChunkError(extractMessage(event))) reloadOnce()
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    if (matchesChunkError(extractMessage(event))) reloadOnce()
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
}
