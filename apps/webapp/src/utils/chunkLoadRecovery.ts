import { matchesChunkError } from './chunkErrorPatterns'

/**
 * Auto-recover from deploy-boundary chunk-load failures by reloading. A stale
 * hashed CSS/JS asset 404s after a deploy; a reload fetches fresh HTML with new
 * chunk hashes. Attempts are counted in sessionStorage across reloads; after
 * MAX_RELOAD_ATTEMPTS in one window the chunk is genuinely broken — stop reloading.
 */
// Keys stay module-private; instrumentation-client asks through
// isChunkRecoveryExhausted() so the two files can't drift on semantics.
const STAMP_KEY = 'docsplus.chunkReloadAt'
const ATTEMPTS_KEY = 'docsplus.chunkReloadAttempts'
const FIRST_ATTEMPT_KEY = 'docsplus.chunkReloadFirstAt'
const EXHAUSTED_KEY = 'docsplus.chunkReloadExhausted'

const BURST_MS = 10_000
const ATTEMPT_WINDOW_MS = 5 * 60_000
const MAX_RELOAD_ATTEMPTS = 2

let hasReloaded = false

// sessionStorage throws in some private-browsing modes (iOS Safari); guard so a
// storage error can't prevent recovery or throw inside the error listener.
const storageGet = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

const storageSet = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Private mode — state not persisted; the module flag still bounds this load.
  }
}

const storageRemove = (key: string): void => {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Private mode — nothing to clear.
  }
}

const readCount = (key: string): number => {
  const value = Number(storageGet(key) || 0)
  return Number.isFinite(value) ? value : 0
}

/** True once reloads within the attempt window failed to fix the chunk error. */
export const isChunkRecoveryExhausted = (): boolean => {
  if (storageGet(EXHAUSTED_KEY) === '1') return true
  // Sentry's own error listener can run before ours stamps the flag; infer
  // exhaustion from the counter so beforeSend sees it on the final failure too.
  const attempts = readCount(ATTEMPTS_KEY)
  const firstAt = readCount(FIRST_ATTEMPT_KEY)
  return attempts >= MAX_RELOAD_ATTEMPTS && Date.now() - firstAt < ATTEMPT_WINDOW_MS
}

const extractMessage = (event: ErrorEvent | PromiseRejectionEvent): string => {
  if (typeof (event as ErrorEvent).message === 'string') return (event as ErrorEvent).message
  const error = (event as { error?: Error }).error
  if (error?.message) return error.message
  const reason = (event as { reason?: unknown }).reason
  return reason instanceof Error ? reason.message : String(reason ?? '')
}

const recoverFromChunkError = (): void => {
  // One reload per page execution, regardless of storage — guards against a burst
  // of simultaneous failed dynamic imports each calling reload().
  if (hasReloaded) return

  // Sibling failures right after a reload stamp are the same burst — recovery
  // is already in flight (or just ran); don't count them as fresh attempts.
  const stamp = readCount(STAMP_KEY)
  if (stamp > 0 && Date.now() - stamp < BURST_MS) return

  let attempts = readCount(ATTEMPTS_KEY)
  let firstAt = readCount(FIRST_ATTEMPT_KEY)
  if (firstAt === 0 || Date.now() - firstAt >= ATTEMPT_WINDOW_MS) {
    // New window (e.g. a later deploy in the same tab) — recovery gets a fresh budget.
    attempts = 0
    firstAt = Date.now()
    storageRemove(EXHAUSTED_KEY)
  }

  if (attempts >= MAX_RELOAD_ATTEMPTS) {
    storageSet(EXHAUSTED_KEY, '1')
    return
  }

  hasReloaded = true
  storageSet(ATTEMPTS_KEY, String(attempts + 1))
  storageSet(FIRST_ATTEMPT_KEY, String(firstAt))
  storageSet(STAMP_KEY, String(Date.now()))
  window.location.reload()
}

let installed = false

/** Install global listeners that reload the page on a stale-asset chunk failure. */
export const installChunkLoadRecovery = (): void => {
  if (typeof window === 'undefined' || installed) return
  installed = true

  const onError = (event: ErrorEvent) => {
    if (matchesChunkError(extractMessage(event))) recoverFromChunkError()
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    if (matchesChunkError(extractMessage(event))) recoverFromChunkError()
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
}
